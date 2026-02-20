import { query } from './database';
import { AlertEvent } from '../alerts/alertManager';

export class AlertStorageDB {
  async saveAlert(alert: AlertEvent) {
    await query(
      `INSERT INTO alerts (id, device_id, channel, alert_type, priority, status, resolved, escalation_level, timestamp, latitude, longitude, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         resolved = EXCLUDED.resolved,
         escalation_level = EXCLUDED.escalation_level,
         acknowledged_at = EXCLUDED.acknowledged_at,
         resolved_at = EXCLUDED.resolved_at,
         metadata = EXCLUDED.metadata`,
      [
        alert.id,
        alert.vehicleId,
        alert.channel,
        alert.type,
        alert.priority,
        alert.status,
        alert.status === 'resolved',
        alert.escalationLevel,
        alert.timestamp,
        alert.location.latitude,
        alert.location.longitude,
        JSON.stringify(alert.metadata)
      ]
    );
  }

  async updateAlertStatus(alertId: string, status: string, acknowledgedAt?: Date, resolvedAt?: Date, notes?: string, resolvedBy?: string) {
    await query(
      `UPDATE alerts
       SET status = $1,
           resolved = CASE WHEN $1 = 'resolved' THEN TRUE ELSE FALSE END,
           acknowledged_at = $2,
           resolved_at = $3,
           resolution_notes = $4,
           resolved_by = $5
       WHERE id = $6`,
      [status, acknowledgedAt, resolvedAt, notes, resolvedBy, alertId]
    );
  }

  async resolveWithNcr(
    alertId: string,
    notes: string,
    resolvedBy?: string,
    ncrDocumentUrl?: string,
    ncrDocumentName?: string
  ): Promise<boolean> {
    const result = await query(
      `UPDATE alerts
       SET status = 'resolved',
           resolved = TRUE,
           resolved_at = NOW(),
           resolution_notes = $1,
           resolved_by = $2,
           closure_type = 'ncr',
           ncr_document_url = $3,
           ncr_document_name = $4,
           is_false_alert = FALSE
       WHERE id = $5`,
      [notes, resolvedBy || null, ncrDocumentUrl || null, ncrDocumentName || null, alertId]
    );
    return (result.rowCount || 0) > 0;
  }

  async markAsFalseAlert(
    alertId: string,
    reason: string,
    markedBy?: string,
    reasonCode?: string
  ): Promise<boolean> {
    const result = await query(
      `UPDATE alerts
       SET is_false_alert = TRUE,
           false_alert_reason = $1,
           false_alert_reason_code = $2,
           resolved_by = $3,
           resolved_at = NOW(),
           status = 'resolved',
           resolved = TRUE,
           closure_type = 'false_alert'
       WHERE id = $4`,
      [reason, reasonCode || null, markedBy || null, alertId]
    );
    return (result.rowCount || 0) > 0;
  }

  async getUnattendedAlerts(minutesThreshold: number = 30) {
    const cutoff = new Date(Date.now() - minutesThreshold * 60000);
    const result = await query(
      `SELECT * FROM alerts 
       WHERE status = 'new' AND timestamp < $1 
       ORDER BY priority DESC, timestamp ASC`,
      [cutoff]
    );
    return result.rows;
  }

  async getActiveAlerts() {
    const result = await query(
      `SELECT * FROM alerts WHERE status IN ('new', 'escalated', 'acknowledged') ORDER BY timestamp DESC`
    );
    return result.rows;
  }

  async getAlertById(alertId: string) {
    const result = await query(`SELECT * FROM alerts WHERE id = $1`, [alertId]);
    return result.rows[0];
  }

  async getAlertWithVideos(alertId: string) {
    const result = await query(
      `SELECT a.*,
         (SELECT file_path FROM videos WHERE alert_id = a.id AND video_type = 'alert_pre') as pre_video_path,
         (SELECT file_path FROM videos WHERE alert_id = a.id AND video_type = 'alert_post') as post_video_path
       FROM alerts a WHERE a.id = $1`,
      [alertId]
    );
    return result.rows[0];
  }
}
