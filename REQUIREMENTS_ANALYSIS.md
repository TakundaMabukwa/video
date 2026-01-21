# Alert Management System - Requirements Analysis & Implementation Roadmap

## Executive Summary

Analysis of current implementation against requirements for a comprehensive alert management system with driver behavior monitoring, speeding detection, and automated reporting.

---

## Current Implementation Status

### ✅ Already Implemented

1. **Alert Detection & Processing**
   - Video alarm parsing (Table 14: 0x14 field)
   - Abnormal driving behavior detection (Table 15: 0x18 field)
   - Priority classification (CRITICAL/HIGH/MEDIUM/LOW)
   - 30-second pre/post event recording (circular buffer)
   - Alert storage in database

2. **Escalation System**
   - Time-based escalation (5min → supervisor, 10min → management)
   - Alert flooding detection (10 alerts/minute threshold)
   - Automatic escalation triggers

3. **Real-time Notifications**
   - WebSocket bell notifications
   - Alert status tracking (new/acknowledged/escalated/resolved)
   - Live alert dashboard

4. **Video Capture**
   - Circular buffer (30 seconds continuous)
   - Automatic screenshot requests (0x9201 command)
   - Pre/post event video clips

---

## Requirements Gap Analysis

### ❌ Missing Features

| Requirement | Status | Implementation Needed |
|-------------|--------|----------------------|
| **Mandatory notes before closing** | ❌ Missing | Add notes field + validation |
| **Screenshot auto-refresh (30s)** | ❌ Missing | Frontend polling/SSE |
| **Screenshot single page view** | ❌ Missing | Gallery component |
| **Alert grouping by priority** | ✅ Partial | Enhance UI grouping |
| **Alert reminder notifications** | ❌ Missing | Periodic reminder system |
| **Complete alert history** | ✅ Implemented | Already in database |
| **Driver speeding detection** | ❌ Missing | Parse speed from 0x0200 |
| **Speeding rating system** | ❌ Missing | New module needed |
| **Demerit system** | ❌ Missing | New module needed |
| **Automated speeding reports** | ❌ Missing | Report generator |

---

## Implementation Roadmap

### Phase 1: Alert Management Enhancements (Week 1)

#### 1.1 Mandatory Notes Before Closing

**Database Schema Addition:**
```sql
ALTER TABLE alerts ADD COLUMN resolution_notes TEXT;
ALTER TABLE alerts ADD COLUMN resolved_by TEXT;
ALTER TABLE alerts ADD COLUMN resolution_timestamp TIMESTAMPTZ;

CREATE TABLE alert_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT REFERENCES alerts(id),
  action_type TEXT NOT NULL, -- 'acknowledged', 'escalated', 'resolved', 'note_added'
  action_by TEXT NOT NULL,
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  metadata JSONB
);
```

**API Endpoint:**
```typescript
POST /api/alerts/:id/resolve
{
  "notes": "Driver was replaced. Incident reviewed with supervisor.",
  "resolvedBy": "operator@company.com"
}

// Validation: Reject if notes < 20 characters
```

**Frontend Component:**
```typescript
// ResolveAlertModal.tsx
- Text area (min 20 chars, max 500 chars)
- Character counter
- Validation before submission
- Confirmation dialog
```

#### 1.2 Screenshot Management

**Auto-Refresh System:**
```typescript
// ScreenshotGallery.tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchScreenshots();
  }, 30000); // 30 seconds
  return () => clearInterval(interval);
}, []);
```

**Single Page Gallery:**
```typescript
GET /api/alerts/:id/screenshots
Response: {
  alert: {...},
  screenshots: [
    { id, url, timestamp, channel },
    ...
  ]
}

// Features:
- Grid layout (3-4 columns)
- Lightbox for full view
- Auto-refresh indicator
- Filter by channel
- Download all button
```

#### 1.3 Alert Reminder System

**New Module: `src/alerts/reminderService.ts`**
```typescript
export class AlertReminderService {
  private reminderIntervals = new Map<string, NodeJS.Timeout>();
  
  // Remind every 15 minutes for unresolved alerts
  startReminder(alert: AlertEvent) {
    if (alert.priority === 'CRITICAL' || alert.priority === 'HIGH') {
      const interval = setInterval(() => {
        this.sendReminder(alert);
      }, 15 * 60 * 1000); // 15 minutes
      
      this.reminderIntervals.set(alert.id, interval);
    }
  }
  
  sendReminder(alert: AlertEvent) {
    // Check if still unresolved
    if (alert.status !== 'resolved') {
      const minutesOpen = (Date.now() - alert.timestamp.getTime()) / 60000;
      
      this.emit('reminder', {
        alertId: alert.id,
        vehicleId: alert.vehicleId,
        type: alert.type,
        priority: alert.priority,
        minutesOpen: Math.floor(minutesOpen),
        message: `Alert ${alert.id} has been open for ${Math.floor(minutesOpen)} minutes`
      });
    }
  }
}
```

**Integration:**
```typescript
// In alertManager.ts
private reminderService = new AlertReminderService();

async processAlert(alert: LocationAlert) {
  // ... existing code ...
  this.reminderService.startReminder(alertEvent);
}
```

---

### Phase 2: Driver Behavior & Speeding System (Week 2)

#### 2.1 Speed Data Extraction

**Parse Speed from Location Report (0x0200):**

According to JT/T 808-2011, location report contains:
- **Byte 16-17**: Speed (WORD) in 0.1 km/h units
- **Byte 18-19**: Direction (WORD)

**Update Parser:**
```typescript
// src/tcp/alertParser.ts
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;        // km/h
  direction: number;    // degrees
  altitude: number;     // meters
  timestamp: Date;
}

parseLocationReport(body: Buffer): LocationData {
  return {
    latitude: body.readUInt32BE(8) / 1000000,
    longitude: body.readUInt32BE(12) / 1000000,
    speed: body.readUInt16BE(16) / 10,  // Convert to km/h
    direction: body.readUInt16BE(18),
    altitude: body.readUInt16BE(20),
    timestamp: new Date()
  };
}
```

#### 2.2 Speeding Detection Module

**New Module: `src/alerts/speedingDetector.ts`**
```typescript
export interface SpeedingEvent {
  id: string;
  vehicleId: string;
  driverId?: string;
  timestamp: Date;
  location: { latitude: number; longitude: number };
  speed: number;
  speedLimit: number;
  excessSpeed: number;
  duration: number; // seconds
  severity: 'minor' | 'moderate' | 'severe';
}

export class SpeedingDetector {
  private speedingEvents = new Map<string, SpeedingEvent[]>();
  private activeSpeedingStart = new Map<string, Date>();
  
  // Speed limits by road type (configurable)
  private speedLimits = {
    highway: 120,
    urban: 60,
    residential: 40,
    default: 80
  };
  
  checkSpeed(vehicleId: string, location: LocationData): SpeedingEvent | null {
    const speedLimit = this.getSpeedLimit(location);
    const excessSpeed = location.speed - speedLimit;
    
    if (excessSpeed > 5) { // 5 km/h tolerance
      return this.recordSpeedingEvent(vehicleId, location, speedLimit, excessSpeed);
    }
    
    return null;
  }
  
  private recordSpeedingEvent(
    vehicleId: string, 
    location: LocationData, 
    speedLimit: number, 
    excessSpeed: number
  ): SpeedingEvent {
    const severity = this.calculateSeverity(excessSpeed);
    
    const event: SpeedingEvent = {
      id: `SPD-${Date.now()}-${vehicleId}`,
      vehicleId,
      timestamp: new Date(),
      location: { latitude: location.latitude, longitude: location.longitude },
      speed: location.speed,
      speedLimit,
      excessSpeed,
      duration: 0,
      severity
    };
    
    // Store event
    if (!this.speedingEvents.has(vehicleId)) {
      this.speedingEvents.set(vehicleId, []);
    }
    this.speedingEvents.get(vehicleId)!.push(event);
    
    return event;
  }
  
  private calculateSeverity(excessSpeed: number): 'minor' | 'moderate' | 'severe' {
    if (excessSpeed > 30) return 'severe';
    if (excessSpeed > 15) return 'moderate';
    return 'minor';
  }
  
  getSpeedingCount(vehicleId: string, timeWindow: number = 24): number {
    const events = this.speedingEvents.get(vehicleId) || [];
    const cutoff = Date.now() - (timeWindow * 60 * 60 * 1000);
    return events.filter(e => e.timestamp.getTime() > cutoff).length;
  }
}
```

#### 2.3 Driver Rating & Demerit System

**Database Schema:**
```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  license_number TEXT,
  current_rating INTEGER DEFAULT 100, -- 0-100 scale
  total_demerits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE speeding_events (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  driver_id TEXT REFERENCES drivers(driver_id),
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  speed DECIMAL(5, 2),
  speed_limit DECIMAL(5, 2),
  excess_speed DECIMAL(5, 2),
  duration INTEGER, -- seconds
  severity TEXT, -- 'minor', 'moderate', 'severe'
  demerits_assigned INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_demerits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id TEXT REFERENCES drivers(driver_id),
  event_id TEXT REFERENCES speeding_events(id),
  event_type TEXT NOT NULL, -- 'speeding', 'fatigue', 'phone_call', etc.
  demerits INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id TEXT REFERENCES drivers(driver_id),
  report_type TEXT NOT NULL, -- 'speeding_threshold', 'monthly_summary'
  report_period_start TIMESTAMPTZ,
  report_period_end TIMESTAMPTZ,
  total_violations INTEGER,
  total_demerits INTEGER,
  report_data JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_to TEXT[] -- email addresses
);
```

**Demerit Assignment Rules:**
```typescript
export class DemeritSystem {
  private demeritRules = {
    speeding: {
      minor: 2,      // 5-15 km/h over
      moderate: 5,   // 15-30 km/h over
      severe: 10     // >30 km/h over
    },
    fatigue: {
      low: 3,        // Fatigue level 50-70
      medium: 7,     // Fatigue level 70-85
      high: 15       // Fatigue level >85
    },
    phoneCall: 5,
    smoking: 3,
    seatbelt: 2
  };
  
  async assignDemerits(driverId: string, event: SpeedingEvent | AlertEvent) {
    const demerits = this.calculateDemerits(event);
    
    await db.query(
      `INSERT INTO driver_demerits (driver_id, event_id, event_type, demerits, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [driverId, event.id, event.type, demerits, event.timestamp]
    );
    
    // Update driver's total demerits and rating
    await this.updateDriverRating(driverId);
    
    // Check if threshold exceeded
    await this.checkThresholds(driverId);
  }
  
  private async updateDriverRating(driverId: string) {
    const result = await db.query(
      `SELECT SUM(demerits) as total FROM driver_demerits 
       WHERE driver_id = $1 AND timestamp > NOW() - INTERVAL '90 days'`,
      [driverId]
    );
    
    const totalDemerits = result.rows[0]?.total || 0;
    const rating = Math.max(0, 100 - totalDemerits);
    
    await db.query(
      `UPDATE drivers SET current_rating = $1, total_demerits = $2 WHERE driver_id = $3`,
      [rating, totalDemerits, driverId]
    );
  }
  
  private async checkThresholds(driverId: string) {
    // Check speeding count in last 24 hours
    const speedingCount = await this.getSpeedingCount(driverId, 24);
    
    if (speedingCount >= 3) {
      await this.generateSpeedingReport(driverId);
    }
  }
}
```

#### 2.4 Automated Report Generation

**New Module: `src/reports/speedingReportGenerator.ts`**
```typescript
export class SpeedingReportGenerator {
  async generateReport(driverId: string): Promise<SpeedingReport> {
    // Get driver info
    const driver = await db.query(
      `SELECT * FROM drivers WHERE driver_id = $1`,
      [driverId]
    );
    
    // Get speeding events (last 24 hours)
    const events = await db.query(
      `SELECT * FROM speeding_events 
       WHERE driver_id = $1 AND timestamp > NOW() - INTERVAL '24 hours'
       ORDER BY timestamp DESC`,
      [driverId]
    );
    
    // Calculate statistics
    const stats = {
      totalViolations: events.rows.length,
      severeCount: events.rows.filter(e => e.severity === 'severe').length,
      moderateCount: events.rows.filter(e => e.severity === 'moderate').length,
      minorCount: events.rows.filter(e => e.severity === 'minor').length,
      maxExcessSpeed: Math.max(...events.rows.map(e => e.excess_speed)),
      avgExcessSpeed: events.rows.reduce((sum, e) => sum + e.excess_speed, 0) / events.rows.length,
      totalDemerits: events.rows.reduce((sum, e) => sum + e.demerits_assigned, 0)
    };
    
    const report: SpeedingReport = {
      id: `RPT-${Date.now()}-${driverId}`,
      driverId,
      driverName: driver.rows[0].name,
      reportType: 'speeding_threshold',
      periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      statistics: stats,
      events: events.rows,
      generatedAt: new Date(),
      recommendations: this.generateRecommendations(stats)
    };
    
    // Save report
    await this.saveReport(report);
    
    // Send notifications
    await this.sendReportNotifications(report);
    
    return report;
  }
  
  private generateRecommendations(stats: any): string[] {
    const recommendations = [];
    
    if (stats.severeCount > 0) {
      recommendations.push('Immediate driver counseling required');
      recommendations.push('Consider temporary suspension pending review');
    }
    
    if (stats.totalViolations >= 5) {
      recommendations.push('Mandatory defensive driving course');
    }
    
    if (stats.maxExcessSpeed > 40) {
      recommendations.push('Vehicle speed limiter installation recommended');
    }
    
    return recommendations;
  }
  
  private async sendReportNotifications(report: SpeedingReport) {
    // Email to management
    await emailService.send({
      to: ['fleet@company.com', 'safety@company.com'],
      subject: `URGENT: Driver ${report.driverName} exceeded speeding threshold`,
      body: this.formatReportEmail(report)
    });
    
    // WebSocket notification
    wsServer.broadcast({
      type: 'speeding_report',
      report: report
    });
  }
}
```

---

### Phase 3: Frontend Dashboard (Week 3)

#### 3.1 Alert Management Screen

**Features:**
- Priority-based grouping (tabs or sections)
- Real-time updates via WebSocket
- Bulk actions (acknowledge multiple, export)
- Filter by vehicle, type, priority, status
- Search functionality
- Timeline view

**Component Structure:**
```typescript
// AlertDashboard.tsx
<AlertDashboard>
  <AlertFilters />
  <AlertStats />
  <PriorityTabs>
    <CriticalAlerts />
    <HighAlerts />
    <MediumAlerts />
  </PriorityTabs>
  <AlertList>
    <AlertCard>
      <AlertHeader />
      <AlertDetails />
      <ScreenshotGallery />
      <VideoPlayer />
      <ActionButtons />
    </AlertCard>
  </AlertList>
</AlertDashboard>
```

#### 3.2 Driver Performance Dashboard

**Features:**
- Driver rating leaderboard
- Speeding violations chart
- Demerit points tracker
- Recent violations list
- Trend analysis
- Export reports

**Component Structure:**
```typescript
// DriverDashboard.tsx
<DriverDashboard>
  <DriverStats />
  <RatingLeaderboard />
  <ViolationChart />
  <DemeritTracker />
  <RecentViolations />
  <ReportGenerator />
</DriverDashboard>
```

---

## API Endpoints Summary

### Alert Management
```
GET    /api/alerts                      # List all alerts
GET    /api/alerts/by-priority          # Grouped by priority
GET    /api/alerts/unresolved           # Unresolved alerts
GET    /api/alerts/:id                  # Get alert details
GET    /api/alerts/:id/screenshots      # Get alert screenshots
GET    /api/alerts/:id/video            # Get alert video clip
POST   /api/alerts/:id/acknowledge      # Acknowledge alert
POST   /api/alerts/:id/resolve          # Resolve alert (requires notes)
POST   /api/alerts/:id/escalate         # Manually escalate
POST   /api/alerts/:id/add-note         # Add note to alert
GET    /api/alerts/history              # Alert history
```

### Driver Management
```
GET    /api/drivers                     # List all drivers
GET    /api/drivers/:id                 # Get driver details
GET    /api/drivers/:id/rating          # Get driver rating
GET    /api/drivers/:id/demerits        # Get demerit history
GET    /api/drivers/:id/violations      # Get violations
POST   /api/drivers/:id/assign-demerits # Assign demerits
GET    /api/drivers/:id/reports         # Get driver reports
```

### Speeding Management
```
GET    /api/speeding/events             # List speeding events
GET    /api/speeding/events/:id         # Get event details
GET    /api/speeding/by-driver          # Group by driver
GET    /api/speeding/by-vehicle         # Group by vehicle
POST   /api/speeding/generate-report    # Generate report
GET    /api/speeding/reports            # List reports
GET    /api/speeding/reports/:id        # Get report details
```

---

## Configuration

### Alert Thresholds
```typescript
// config/alerts.ts
export const alertConfig = {
  escalation: {
    level1: 5 * 60,    // 5 minutes
    level2: 10 * 60    // 10 minutes
  },
  flooding: {
    threshold: 10,
    windowSeconds: 60
  },
  reminders: {
    interval: 15 * 60,  // 15 minutes
    priorities: ['CRITICAL', 'HIGH']
  }
};
```

### Speeding Thresholds
```typescript
// config/speeding.ts
export const speedingConfig = {
  tolerance: 5,  // km/h
  speedLimits: {
    highway: 120,
    urban: 60,
    residential: 40,
    default: 80
  },
  severity: {
    minor: { min: 5, max: 15, demerits: 2 },
    moderate: { min: 15, max: 30, demerits: 5 },
    severe: { min: 30, max: 999, demerits: 10 }
  },
  reportThreshold: 3  // violations in 24 hours
};
```

### Demerit System
```typescript
// config/demerits.ts
export const demeritConfig = {
  rules: {
    speeding_minor: 2,
    speeding_moderate: 5,
    speeding_severe: 10,
    fatigue_low: 3,
    fatigue_medium: 7,
    fatigue_high: 15,
    phone_call: 5,
    smoking: 3,
    no_seatbelt: 2
  },
  ratingPeriod: 90,  // days
  thresholds: {
    warning: 20,
    suspension: 50,
    termination: 100
  }
};
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('SpeedingDetector', () => {
  it('should detect speeding when speed exceeds limit', () => {});
  it('should calculate correct severity', () => {});
  it('should track speeding duration', () => {});
});

describe('DemeritSystem', () => {
  it('should assign correct demerits for speeding', () => {});
  it('should update driver rating', () => {});
  it('should trigger report when threshold exceeded', () => {});
});

describe('AlertManager', () => {
  it('should require notes before resolving', () => {});
  it('should send reminders for unresolved alerts', () => {});
});
```

### Integration Tests
```typescript
describe('Alert Workflow', () => {
  it('should create alert, capture video, send notification', () => {});
  it('should escalate after timeout', () => {});
  it('should prevent resolution without notes', () => {});
});

describe('Speeding Workflow', () => {
  it('should detect speeding, assign demerits, generate report', () => {});
  it('should send report after 3 violations', () => {});
});
```

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Speed limit data loaded
- [ ] Driver data imported
- [ ] Email service configured
- [ ] WebSocket server tested
- [ ] Frontend deployed
- [ ] API endpoints tested
- [ ] Notification system verified
- [ ] Report generation tested
- [ ] Backup system configured
- [ ] Monitoring alerts set up

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Week 1 | Mandatory notes, screenshot gallery, reminders |
| **Phase 2** | Week 2 | Speeding detection, demerit system, reports |
| **Phase 3** | Week 3 | Frontend dashboards, testing, deployment |

**Total**: 3 weeks for complete implementation

---

## Success Metrics

1. **Alert Management**
   - 100% of alerts require notes before closing
   - Average resolution time < 30 minutes
   - Zero missed escalations

2. **Driver Safety**
   - 50% reduction in speeding violations within 3 months
   - 100% of threshold violations reported within 1 hour
   - Driver rating system adopted by management

3. **System Performance**
   - Screenshot refresh < 30 seconds
   - Alert notifications < 5 seconds
   - Report generation < 10 seconds

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Ready for Implementation
