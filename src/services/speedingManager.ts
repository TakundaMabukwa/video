import { query } from '../storage/database';

export class SpeedingManager {
  async recordSpeedingEvent(vehicleId: string, driverId: string | null, speed: number, speedLimit: number, location: { latitude: number; longitude: number }) {
    const excessSpeed = speed - speedLimit;
    const severity = excessSpeed > 40 ? 'severe' : excessSpeed > 20 ? 'moderate' : 'minor';
    
    const eventId = `SPD-${Date.now()}-${vehicleId}`;
    
    await query(
      `INSERT INTO speeding_events (id, vehicle_id, driver_id, timestamp, latitude, longitude, speed, speed_limit, excess_speed, severity)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
      [eventId, vehicleId, driverId, location.latitude, location.longitude, speed, speedLimit, excessSpeed, severity]
    );
    
    // Check if driver has >3 speeding events in last 7 days
    if (driverId) {
      const result = await query(
        `SELECT COUNT(*) as count FROM speeding_events 
         WHERE driver_id = $1 AND timestamp > NOW() - INTERVAL '7 days'`,
        [driverId]
      );
      
      if (parseInt(result.rows[0].count) >= 3) {
        await this.generateSpeedingReport(driverId, vehicleId);
        await this.applyDemerit(driverId, severity);
      }
    }
    
    return eventId;
  }
  
  private async applyDemerit(driverId: string, severity: string) {
    const demerits = severity === 'severe' ? 10 : severity === 'moderate' ? 5 : 2;
    
    await query(
      `UPDATE drivers 
       SET total_demerits = total_demerits + $1,
           current_rating = GREATEST(0, current_rating - $1)
       WHERE driver_id = $2`,
      [demerits, driverId]
    );
  }
  
  private async generateSpeedingReport(driverId: string, vehicleId: string) {
    const events = await query(
      `SELECT * FROM speeding_events 
       WHERE driver_id = $1 AND timestamp > NOW() - INTERVAL '7 days'
       ORDER BY timestamp DESC`,
      [driverId]
    );
    
    console.log(`🚨 SPEEDING REPORT: Driver ${driverId} has ${events.rows.length} speeding events in last 7 days`);
    
    // TODO: Generate PDF report and send to management
    // This would integrate with your reporting system
  }
}
