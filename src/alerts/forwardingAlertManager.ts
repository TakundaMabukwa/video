import { AlertManager, ExternalAlertInput } from './alertManager';
import { WorkerForwarder } from '../services/workerForwarder';
import { LocationAlert } from '../types/jtt';

const STORAGE_SIGNAL_CODES = new Set([
  'jtt1078_storage_failure',
  'platform_video_alarm_0103',
  'custom_keyword_storage_failure'
]);

const STORAGE_ALERT_TYPES = new Set([
  'storage failure',
  'storage unit failure'
]);

export class ForwardingAlertManager extends AlertManager {
  constructor(private readonly forwarder: WorkerForwarder) {
    super();
  }

  private isSuppressedStorageExternalAlert(input: ExternalAlertInput): boolean {
    const signalCode = String(input.signalCode || '').trim().toLowerCase();
    const type = String(input.type || '').trim().toLowerCase();
    return STORAGE_SIGNAL_CODES.has(signalCode) || STORAGE_ALERT_TYPES.has(type);
  }

  private sanitizeForwardedLocationAlert(alert: LocationAlert): LocationAlert | null {
    const next: LocationAlert = {
      ...alert,
      videoAlarms: alert.videoAlarms
        ? {
            ...alert.videoAlarms,
            storageFailure: false,
            setBits: Array.isArray(alert.videoAlarms.setBits)
              ? alert.videoAlarms.setBits.filter((bit) => bit !== 2)
              : []
          }
        : alert.videoAlarms,
      vendorExtensions: Array.isArray(alert.vendorExtensions)
        ? alert.vendorExtensions.map((extension) => ({
            ...extension,
            detectedCodes: Array.isArray(extension.detectedCodes)
              ? extension.detectedCodes.filter((code) => Number(code) !== 0x0103 && Number(code) !== 259)
              : extension.detectedCodes
          }))
        : alert.vendorExtensions
    };

    const hasStorageBit = Boolean(alert.videoAlarms?.storageFailure)
      || Boolean(alert.videoAlarms?.setBits?.includes?.(2))
      || Boolean(alert.vendorExtensions?.some?.((extension) =>
        Array.isArray(extension.detectedCodes)
          && extension.detectedCodes.some((code) => Number(code) === 0x0103 || Number(code) === 259)
      ));

    const hasOtherVideoSignals = Boolean(
      next.videoAlarms?.videoSignalLoss
      || next.videoAlarms?.videoSignalBlocking
      || next.videoAlarms?.otherVideoFailure
      || next.videoAlarms?.busOvercrowding
      || next.videoAlarms?.abnormalDriving
      || next.videoAlarms?.specialAlarmThreshold
      || next.signalLossChannels?.length
      || next.blockingChannels?.length
      || next.memoryFailures?.main?.length
      || next.memoryFailures?.backup?.length
      || next.vendorExtensions?.some?.((extension) => Array.isArray(extension.detectedCodes) && extension.detectedCodes.length > 0)
      || next.vendorExtensions?.some?.((extension) => (extension.alarmLevel ?? 0) > 0 && Number.isFinite(extension.eventType))
      || next.alarmFlagSetBits?.length
      || Object.values(next.alarmFlags || {}).some(Boolean)
    );

    if (hasStorageBit && !hasOtherVideoSignals) {
      return null;
    }

    return next;
  }

  override async processAlert(alert: LocationAlert): Promise<void> {
    const sanitized = this.sanitizeForwardedLocationAlert(alert);
    if (!sanitized) return;

    await this.forwarder.forwardLocationAlert(
      sanitized,
      String((alert as any)?.sourceMessageId || '0x0200')
    );
  }

  override async processExternalAlert(input: ExternalAlertInput): Promise<void> {
    if (this.isSuppressedStorageExternalAlert(input)) {
      return;
    }

    await this.forwarder.forwardExternalAlert(input);
  }

  override getActiveAlerts() {
    return [];
  }

  override getAlertById() {
    return undefined;
  }
}
