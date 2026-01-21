import { EventEmitter } from 'events';
import { LocationAlert } from '../types/jtt';
import { CircularVideoBuffer } from './circularBuffer';
import { AlertEscalation } from './escalation';
import { AlertNotifier } from './notifier';
import { AlertStorageDB } from '../storage/alertStorageDB';

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
  videoClipPath?: string;  // Legacy: pre-event clip path
  status: 'new' | 'acknowledged' | 'escalated' | 'resolved';
  escalationLevel: number;
  metadata: any & {
    videoClips?: {
      pre?: string;      // Pre-event (30s before) clip path
      post?: string;     // Post-event (30s after) clip path
      preFrameCount?: number;
      postFrameCount?: number;
      preDuration?: number;
      postDuration?: number;
      cameraVideo?: string;  // Video retrieved from camera SD card
    };
  };
}

export class AlertManager extends EventEmitter {
  private videoBuffers = new Map<string, CircularVideoBuffer>();
  private activeAlerts = new Map<string, AlertEvent>();
  private escalation: AlertEscalation;
  private notifier: AlertNotifier;
  private alertStorage = new AlertStorageDB();
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
      const buffer = new CircularVideoBuffer(vehicleId, channel, 30);
      
      // Listen for post-event clip completion
      buffer.on('post-event-complete', async ({ alertId, clipPath, frameCount, duration }) => {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
          // Update alert with post-event video path
          if (!alert.metadata.videoClips) {
            alert.metadata.videoClips = {};
          }
          alert.metadata.videoClips.post = clipPath;
          alert.metadata.videoClips.postFrameCount = frameCount;
          alert.metadata.videoClips.postDuration = duration;
          
          console.log(`✅ Alert ${alertId}: Post-event video linked (${frameCount} frames, ${duration.toFixed(1)}s)`);
          
          // Update in database
          await this.alertStorage.saveAlert(alert);
          
          // Emit event for any listeners
          this.emit('alert-video-complete', { alertId, type: 'post', clipPath });
        }
      });
      
      this.videoBuffers.set(key, buffer);
      console.log(`📹 Circular buffer initialized: ${key}`);
    }
  }

  addFrameToBuffer(vehicleId: string, channel: number, frameData: Buffer, timestamp: Date, isIFrame: boolean): void {
    const key = `${vehicleId}_${channel}`;
    
    // Auto-initialize buffer if it doesn't exist (ensures we capture video even before startVideo is called)
    if (!this.videoBuffers.has(key)) {
      this.initializeBuffer(vehicleId, channel);
    }
    
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

    // Save alert to database
    await this.alertStorage.saveAlert(alertEvent);

    // Request immediate screenshot for alert evidence (ALL alerts)
    console.log(`📸 Requesting screenshot for alert ${alertId}`);
    this.emit('request-screenshot', { vehicleId: alert.vehicleId, channel, alertId });

    // For driver-related alerts ONLY: capture video from buffer + request from camera SD
    if (this.isDriverRelatedAlert(alert)) {
      // Capture from circular buffer (30s pre/post)
      await this.captureEventVideo(alertEvent);
      
      // Request 30s before/after from camera SD card
      await this.requestAlertVideoFromCamera(alertEvent);
    }

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
    
    // Store pre-event video path in alert metadata
    if (!alert.metadata.videoClips) {
      alert.metadata.videoClips = {};
    }
    alert.metadata.videoClips.pre = clipPath;
    alert.videoClipPath = clipPath; // Keep for backwards compatibility
    
    // Update in database with pre-event clip info
    await this.alertStorage.saveAlert(alert);
    
    console.log(`✅ Alert ${alert.id}: Pre-event video captured, post-event recording started (30s)`);
  }

  private determinePriority(alert: LocationAlert): AlertPriority {
    // CRITICAL: Fatigue level > 80 (per JTT 1078-2016 Table 15)
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

    // Add speed-based alerts if speed data available
    if (alert.speed && alert.speed > 100) { // Example: 100+ km/h = HIGH priority
      return AlertPriority.HIGH;
    }
    if (alert.speed && alert.speed > 80) { // Example: 80+ km/h = MEDIUM priority  
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

  async acknowledgeAlert(id: string): Promise<boolean> {
    const alert = this.activeAlerts.get(id);
    if (alert && alert.status === 'new') {
      alert.status = 'acknowledged';
      await this.alertStorage.updateAlertStatus(id, 'acknowledged', new Date());
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  async resolveAlert(id: string, notes?: string, resolvedBy?: string): Promise<boolean> {
    const alert = this.activeAlerts.get(id);
    if (alert) {
      alert.status = 'resolved';
      await this.alertStorage.updateAlertStatus(id, 'resolved', undefined, new Date(), notes, resolvedBy);
      this.escalation.stopMonitoring(id);
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  async escalateAlert(id: string): Promise<boolean> {
    const alert = this.activeAlerts.get(id);
    if (alert) {
      alert.status = 'escalated';
      alert.escalationLevel++;
      await this.alertStorage.saveAlert(alert);
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

  private isDriverRelatedAlert(alert: LocationAlert): boolean {
    return !!(alert.drivingBehavior?.fatigue || 
             alert.drivingBehavior?.phoneCall || 
             alert.drivingBehavior?.smoking ||
             (alert.speed && alert.speed > 80)); // Include speeding
  }

  private async requestAlertVideoFromCamera(alert: AlertEvent): Promise<void> {
    // Calculate 30s before and after alert time
    const alertTime = alert.timestamp;
    const startTime = new Date(alertTime.getTime() - 30 * 1000); // 30s before
    const endTime = new Date(alertTime.getTime() + 30 * 1000);   // 30s after

    console.log(`🎥 Requesting 30s pre/post video from camera SD card for alert ${alert.id}`);
    
    // Emit request for camera video retrieval (0x9201 command)
    this.emit('request-camera-video', {
      vehicleId: alert.vehicleId,
      channel: alert.channel,
      startTime,
      endTime,
      alertId: alert.id,
      audioVideoType: 2, // Video only
      streamType: 1,     // Main stream
      memoryType: 1,     // Main storage
      playbackMethod: 0  // Normal playback
    });
  }
}
