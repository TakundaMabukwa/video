import { EventEmitter } from 'events';
import { AlertEvent, AlertPriority } from './alertManager';

export class AlertNotifier extends EventEmitter {
  sendAlertNotification(alert: AlertEvent): void {
    const notification = {
      type: 'new_alert',
      alertId: alert.id,
      vehicleId: alert.vehicleId,
      priority: alert.priority,
      alertType: alert.type,
      timestamp: alert.timestamp,
      location: alert.location,
      sound: this.getSoundForPriority(alert.priority)
    };

    this.emit('notification', notification);
    console.log(`🔔 Alert notification: ${alert.type} - ${alert.priority}`);
  }

  sendEscalationNotification(alert: AlertEvent): void {
    const notification = {
      type: 'escalation',
      alertId: alert.id,
      vehicleId: alert.vehicleId,
      priority: alert.priority,
      alertType: alert.type,
      escalationLevel: alert.escalationLevel,
      timestamp: new Date(),
      sound: 'escalation_bell'
    };

    this.emit('notification', notification);
    console.log(`🚨 ESCALATION Level ${alert.escalationLevel}: ${alert.type} - ${alert.id}`);
  }

  sendFloodingAlert(vehicleId: string, count: number): void {
    const notification = {
      type: 'flooding',
      vehicleId,
      count,
      timestamp: new Date(),
      sound: 'critical_bell'
    };

    this.emit('notification', notification);
    console.log(`⚠️ ALERT FLOODING: ${vehicleId} - ${count} alerts in 1 minute`);
  }

  private getSoundForPriority(priority: AlertPriority): string {
    switch (priority) {
      case AlertPriority.CRITICAL:
        return 'critical_bell';
      case AlertPriority.HIGH:
        return 'high_bell';
      case AlertPriority.MEDIUM:
        return 'medium_bell';
      default:
        return 'low_bell';
    }
  }
}
