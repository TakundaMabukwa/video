import { AlertEvent, AlertPriority, AlertManager } from './alertManager';

interface EscalationRule {
  delaySeconds: number;
  level: number;
  notifyRole: string;
}

export class AlertEscalation {
  private escalationTimers = new Map<string, NodeJS.Timeout>();
  private alertManager: AlertManager;
  private floodingWindow = new Map<string, Date[]>(); // vehicleId -> timestamps

  private rules: EscalationRule[] = [
    { delaySeconds: 300, level: 1, notifyRole: 'supervisor' },    // 5 min
    { delaySeconds: 600, level: 2, notifyRole: 'management' }     // 10 min
  ];

  private floodingThreshold = 10; // alerts per minute
  private floodingWindowSeconds = 60;

  constructor(alertManager: AlertManager) {
    this.alertManager = alertManager;
  }

  monitorAlert(alert: AlertEvent): void {
    // Check for alert flooding
    this.checkFlooding(alert.vehicleId);

    // Skip escalation for low priority
    if (alert.priority === AlertPriority.LOW) return;

    // Set up escalation timers
    for (const rule of this.rules) {
      const timer = setTimeout(() => {
        this.escalateIfNeeded(alert.id, rule);
      }, rule.delaySeconds * 1000);

      this.escalationTimers.set(`${alert.id}_${rule.level}`, timer);
    }

    console.log(`⏱️ Escalation monitoring started for alert ${alert.id}`);
  }

  private escalateIfNeeded(alertId: string, rule: EscalationRule): void {
    const alert = this.alertManager.getAlertById(alertId);
    
    if (!alert) return;
    
    // Only escalate if still unacknowledged
    if (alert.status === 'new') {
      console.log(`⚠️ Escalating alert ${alertId} to ${rule.notifyRole} (Level ${rule.level})`);
      this.alertManager.escalateAlert(alertId);
    }
  }

  private checkFlooding(vehicleId: string): void {
    const now = new Date();
    
    if (!this.floodingWindow.has(vehicleId)) {
      this.floodingWindow.set(vehicleId, []);
    }

    const timestamps = this.floodingWindow.get(vehicleId)!;
    
    // Add current alert
    timestamps.push(now);

    // Remove old timestamps outside window
    const cutoff = new Date(now.getTime() - this.floodingWindowSeconds * 1000);
    const recentAlerts = timestamps.filter(t => t >= cutoff);
    this.floodingWindow.set(vehicleId, recentAlerts);

    // Check if flooding threshold exceeded
    if (recentAlerts.length >= this.floodingThreshold) {
      console.log(`🚨 ALERT FLOODING DETECTED: ${vehicleId} - ${recentAlerts.length} alerts`);
      this.alertManager.emit('flooding', { vehicleId, count: recentAlerts.length });
    }
  }

  stopMonitoring(alertId: string): void {
    // Clear all timers for this alert
    for (const rule of this.rules) {
      const timerKey = `${alertId}_${rule.level}`;
      const timer = this.escalationTimers.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        this.escalationTimers.delete(timerKey);
      }
    }
  }
}
