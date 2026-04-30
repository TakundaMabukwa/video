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
  private readonly minForwardIntervalMs = Math.max(
    250,
    Number(process.env.ALERT_FORWARD_MIN_INTERVAL_MS || 3000)
  );
  private readonly forwardedState = new Map<
    string,
    { active: boolean; signature: string; forwardedAt: number }
  >();

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

  private resolveForwardChannel(alert: LocationAlert): number {
    if (Array.isArray(alert.signalLossChannels) && alert.signalLossChannels.length > 0) {
      return Number(alert.signalLossChannels[0] || 1);
    }
    if (Array.isArray(alert.blockingChannels) && alert.blockingChannels.length > 0) {
      return Number(alert.blockingChannels[0] || 1);
    }
    return 1;
  }

  private buildForwardSnapshotSignature(alert: LocationAlert): string {
    const signals: string[] = [];
    const alarmFlags = alert.alarmFlags || ({} as Record<string, any>);
    const videoAlarms = alert.videoAlarms || ({} as Record<string, any>);
    const driving = alert.drivingBehavior || ({} as Record<string, any>);

    const alarmBits = Array.isArray(alert.alarmFlagSetBits) ? alert.alarmFlagSetBits : [];
    const videoBits = Array.isArray(alert.videoAlarms?.setBits) ? alert.videoAlarms!.setBits || [] : [];
    const signalLoss = Array.isArray(alert.signalLossChannels) ? alert.signalLossChannels : [];
    const blocking = Array.isArray(alert.blockingChannels) ? alert.blockingChannels : [];
    const memMain = Array.isArray(alert.memoryFailures?.main) ? alert.memoryFailures!.main : [];
    const memBackup = Array.isArray(alert.memoryFailures?.backup) ? alert.memoryFailures!.backup : [];
    const vendorCodes = (Array.isArray(alert.vendorExtensions) ? alert.vendorExtensions : [])
      .flatMap((entry) => (Array.isArray(entry.detectedCodes) ? entry.detectedCodes : []))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    for (const [key, value] of Object.entries(alarmFlags)) {
      if (value === true) signals.push(`a:${key}`);
    }
    for (const [key, value] of Object.entries(videoAlarms)) {
      if (key === 'setBits') continue;
      if (value === true) signals.push(`v:${key}`);
    }
    if (driving.fatigue) signals.push('d:fatigue');
    if (driving.phoneCall) signals.push('d:phone_call');
    if (driving.smoking) signals.push('d:smoking');
    if (Number(driving.custom) > 0) signals.push(`d:custom:${Number(driving.custom)}`);

    for (const bit of alarmBits) {
      const value = Number(bit);
      if (Number.isFinite(value)) signals.push(`ab:${value}`);
    }
    for (const bit of videoBits) {
      const value = Number(bit);
      if (Number.isFinite(value)) signals.push(`vb:${value}`);
    }
    for (const ch of signalLoss) {
      const value = Number(ch);
      if (Number.isFinite(value)) signals.push(`sl:${value}`);
    }
    for (const ch of blocking) {
      const value = Number(ch);
      if (Number.isFinite(value)) signals.push(`bl:${value}`);
    }
    for (const ch of memMain) {
      const value = Number(ch);
      if (Number.isFinite(value)) signals.push(`mm:${value}`);
    }
    for (const ch of memBackup) {
      const value = Number(ch);
      if (Number.isFinite(value)) signals.push(`mb:${value}`);
    }
    for (const code of vendorCodes) {
      signals.push(`ve:${code}`);
    }

    return Array.from(new Set(signals)).sort().join('|');
  }

  override async processAlert(alert: LocationAlert): Promise<void> {
    const sanitized = this.sanitizeForwardedLocationAlert(alert);
    if (!sanitized) return;

    const vehicleId = String(sanitized.vehicleId || '').trim();
    if (!vehicleId) return;
    const channel = this.resolveForwardChannel(sanitized);
    const key = `${vehicleId}|${channel}`;
    const now = Date.now();
    const signature = this.buildForwardSnapshotSignature(sanitized);
    const hasSignals = signature.length > 0;
    const previous = this.forwardedState.get(key);

    // Do not forward idle packets repeatedly. Forward one "clear" packet only when
    // transitioning from active -> idle so downstream edge-state can be released.
    if (!hasSignals) {
      if (!previous?.active) {
        return;
      }
      await this.forwarder.forwardLocationAlert(
        sanitized,
        String((alert as any)?.sourceMessageId || '0x0200')
      );
      this.forwardedState.set(key, { active: false, signature: '', forwardedAt: now });
      return;
    }

    // Throttle unchanged active snapshots to prevent flooding alert worker.
    if (
      previous?.active &&
      previous.signature === signature &&
      now - previous.forwardedAt < this.minForwardIntervalMs
    ) {
      return;
    }

    await this.forwarder.forwardLocationAlert(
      sanitized,
      String((alert as any)?.sourceMessageId || '0x0200')
    );
    this.forwardedState.set(key, { active: true, signature, forwardedAt: now });
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
