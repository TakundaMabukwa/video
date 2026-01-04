import * as fs from 'fs';
import * as path from 'path';
import { LocationAlert } from '../types/jtt';

interface AlertDatabase {
  alerts: LocationAlert[];
}

export class AlertStorage {
  private dbPath = path.join(__dirname, '../../alerts.json');

  saveAlert(alert: LocationAlert): void {
    try {
      const db = this.loadDatabase();
      db.alerts.push(alert);
      fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Failed to save alert:', error);
    }
  }

  getAlerts(): LocationAlert[] {
    return this.loadDatabase().alerts;
  }

  private loadDatabase(): AlertDatabase {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return { alerts: [] };
    }
  }
}