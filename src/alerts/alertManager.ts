import { EventEmitter } from 'events';
import { LocationAlert } from '../types/jtt';
import { CircularVideoBuffer } from './circularBuffer';
import { AlertEscalation } from './escalation';
import { AlertNotifier } from './notifier';

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AlertEvent {
  id: string;
  vehicleId: string;
  channel: number;
  priority: AlertPriority;
  type: string;
  timestamp: Date;
  location: { latitude: number; longitude: number };
  videoClipPath?: string;
  status: 'new' | 'acknowledged' | 'escalated' | 'resolved';
  escalationLevel: number;
  metadata: any;
}

export class AlertManager extends EventEmitter {
  private videoBuffers = new Map<string, CircularVideoBuffer>();
  private activeAlerts = new Map<string, AlertEvent>();
  private escalation: AlertEscalation;
  private notifier: AlertNotifier;
  private alertCounter = 0;

  constructor() {
    super();
    this.escalation = new AlertEscalation(this);
    this.notifier = new AlertNotifier();

    // Forward notifier events
    this.notifier.on('notification', (notification) => {
      this.emit('notification', notification);
    });

    // Handle flooding events
    this.on('flooding', ({ vehicleId, count }) => {
      this.notifier.sendFloodingAlert(vehicleId, count);
    });
  }

  initializeBuffer(vehicleId: string, channel: number): void {
    const key = `${vehicleId}_${channel}`;
    if (!this.videoBuffers.has(key)) {
      this.videoBuffers.set(key, new CircularVideoBuffer(vehicleId, channel, 30));
      console.log(`📹 Circular buffer initialized: ${key}`);
    }
  }

  addFrameToBuffer(vehicleId: string, channel: number, frameData: Buffer, timestamp: Date, isIFrame: boolean): void {
    const key = `${vehicleId}_${channel}`;
    const buffer = this.videoBuffers.get(key);
    if (buffer) {
      buffer.addFrame(frameData, timestamp, isIFrame);
    }
  }

  async processAlert(alert: LocationAlert): Promise<void> {
    const priority = this.determinePriority(alert);
    
    if (priority === AlertPriority.LOW) return;

    const alertId = `ALT-${Date.now()}-${++this.alertCounter}`;
    const channel = this.extractChannelFromAlert(alert);

    const alertEvent: AlertEvent = {
      id: alertId,
      vehicleId: alert.vehicleId,
      channel,
      priority,
      type: this.getAlertType(alert),
      timestamp: alert.timestamp,
      location: { latitude: alert.latitude, longitude: alert.longitude },
      status: 'new',
      escalationLevel: 0,
      metadata: alert
    };

    this.activeAlerts.set(alertId, alertEvent);

    // Capture 30s pre + 30s post video
    await this.captureEventVideo(alertEvent);

    // Send bell notification
    this.notifier.sendAlertNotification(alertEvent);

    // Start escalation monitoring
    this.escalation.monitorAlert(alertEvent);

    this.emit('alert', alertEvent);

    console.log(`🚨 Alert ${alertId}: ${alertEvent.type} [${priority}]`);
  }

  private async captureEventVideo(alert: AlertEvent): Promise<void> {
    const key = `${alert.vehicleId}_${alert.channel}`;
    const buffer = this.videoBuffers.get(key);

    if (!buffer) {
      console.warn(`⚠️ No buffer for ${key}, cannot capture pre-event video`);
      return;
    }

    const clipPath = await buffer.captureEventClip(alert.id, 30);
    alert.videoClipPath = clipPath;
  }

  private determinePriority(alert: LocationAlert): AlertPriority {
    // CRITICAL: Fatigue > 80
    if (alert.drivingBehavior?.fatigueLevel && alert.drivingBehavior.fatigueLevel > 80) {
      return AlertPriority.CRITICAL;
    }

    // HIGH: Fatigue, phone call, smoking, storage failure
    if (alert.drivingBehavior?.fatigue || 
        alert.drivingBehavior?.phoneCall || 
        alert.drivingBehavior?.smoking ||
        alert.videoAlarms?.storageFailure) {
      return AlertPriority.HIGH;
    }

    // MEDIUM: Signal loss, blocking, overcrowding
    if (alert.videoAlarms?.videoSignalLoss ||
        alert.videoAlarms?.videoSignalBlocking ||
        alert.videoAlarms?.busOvercrowding) {
      return AlertPriority.MEDIUM;
    }

    return AlertPriority.LOW;
  }

  private getAlertType(alert: LocationAlert): string {
    if (alert.drivingBehavior?.fatigue) return 'Driver Fatigue';
    if (alert.drivingBehavior?.phoneCall) return 'Phone Call While Driving';
    if (alert.drivingBehavior?.smoking) return 'Smoking While Driving';
    if (alert.videoAlarms?.storageFailure) return 'Storage Failure';
    if (alert.videoAlarms?.videoSignalLoss) return 'Video Signal Loss';
    if (alert.videoAlarms?.videoSignalBlocking) return 'Video Signal Blocked';
    if (alert.videoAlarms?.busOvercrowding) return 'Bus Overcrowding';
    return 'General Alert';
  }

  private extractChannelFromAlert(alert: LocationAlert): number {
    if (alert.signalLossChannels && alert.signalLossChannels.length > 0) {
      return alert.signalLossChannels[0];
    }
    if (alert.blockingChannels && alert.blockingChannels.length > 0) {
      return alert.blockingChannels[0];
    }
    return 1;
  }

  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values())
      .filter(a => a.status !== 'resolved')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlertById(id: string): AlertEvent | undefined {
    return this.activeAlerts.get(id);
  }

  acknowledgeAlert(id: string): boolean {
    const alert = this.activeAlerts.get(id);
    if (alert && alert.status === 'new') {
      alert.status = 'acknowledged';
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  resolveAlert(id: string): boolean {
    const alert = this.activeAlerts.get(id);
    if (alert) {
      alert.status = 'resolved';
      this.escalation.stopMonitoring(id);
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  escalateAlert(id: string): boolean {
    const alert = this.activeAlerts.get(id);
    if (alert) {
      alert.status = 'escalated';
      alert.escalationLevel++;
      this.notifier.sendEscalationNotification(alert);
      this.emit('alert-escalated', alert);
      return true;
    }
    return false;
  }

  getAlertStats() {
    const alerts = Array.from(this.activeAlerts.values());
    return {
      total: alerts.length,
      new: alerts.filter(a => a.status === 'new').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      escalated: alerts.filter(a => a.status === 'escalated').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      byPriority: {
        critical: alerts.filter(a => a.priority === AlertPriority.CRITICAL).length,
        high: alerts.filter(a => a.priority === AlertPriority.HIGH).length,
        medium: alerts.filter(a => a.priority === AlertPriority.MEDIUM).length,
        low: alerts.filter(a => a.priority === AlertPriority.LOW).length
      }
    };
  }

  getBufferStats() {
    const stats: any = {};
    for (const [key, buffer] of this.videoBuffers.entries()) {
      stats[key] = buffer.getStats();
    }
    return stats;
  }
}
