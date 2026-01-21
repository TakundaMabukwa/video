# Driver Alert Detection - JT/T 1078 Specification Guide

## How Driver Alerts Are Flagged (According to Spec)

---

## 1. Location Report Structure (0x0200)

### Message Flow:
```
Camera → TCP Server (Port 7611) → 0x0200 Location Report
```

### Base Message (28 bytes):
```
Byte 0-3:   Alarm Flag (DWORD) ← MAIN ALERT INDICATOR
Byte 4-7:   Status Flag (DWORD)
Byte 8-11:  Latitude
Byte 12-15: Longitude
Byte 16-17: Altitude
Byte 18-19: Speed (0.1 km/h units)
Byte 20-21: Direction
Byte 22-27: Timestamp (BCD)
```

### Additional Information (After byte 28):
```
Byte 28+:   Additional Info ID + Length + Data
```

---

## 2. Driver Alert Indicators

### Primary Indicator: Alarm Flag (Byte 0-3)

**From JT/T 808-2011 Table 18:**

```
bit 0:  Emergency alarm
bit 1:  Overspeed alarm
bit 2:  Fatigue driving alarm
bit 3:  Dangerous driving behavior alarm (includes phone, smoking)
bit 4:  GNSS module failure
bit 5:  GNSS antenna disconnected
bit 6:  GNSS antenna short circuit
bit 7:  Main power under-voltage
bit 8:  Main power power-down
bit 9:  LCD or display failure
bit 10: TTS module failure
bit 11: Camera failure
bit 12: Road transport certificate IC card module failure
bit 13: Overspeed warning
bit 14: Fatigue driving warning
bit 15-17: Reserved for day overspeed
bit 18: Cumulative driving timeout on the day
bit 19: Parking timeout
bit 20-21: In/out area
bit 22-23: In/out route
bit 24: Route driving time insufficient/too long
bit 25: Route deviation alarm
bit 26: Vehicle VSS failure
bit 27: Vehicle fuel abnormality
bit 28: Vehicle theft (displacement)
bit 29: Illegal ignition
bit 30: Illegal displacement
bit 31: Collision warning
```

### Secondary Indicator: Additional Info 0x18

**From JT/T 1078-2016 Table 15:**

```
Byte 0-1: Behavior Flags (WORD)
  bit 0:  Fatigue
  bit 1:  Phone call
  bit 2:  Smoking
  bit 3-10: Reserved
  bit 11-15: Custom

Byte 2: Fatigue Level (BYTE, 0-100)
```

---

## 3. How to Detect Driver Alerts

### Method 1: Check Alarm Flag (Primary)

```typescript
// Parse alarm flag from byte 0-3
const alarmFlag = body.readUInt32BE(0);

// Check for driver-related alarms
const hasEmergency = !!(alarmFlag & (1 << 0));
const hasOverspeed = !!(alarmFlag & (1 << 1));
const hasFatigue = !!(alarmFlag & (1 << 2));
const hasDangerousDriving = !!(alarmFlag & (1 << 3));
const hasOverspeedWarning = !!(alarmFlag & (1 << 13));
const hasFatigueWarning = !!(alarmFlag & (1 << 14));

// If ANY of these are true, there's a driver alert
const hasDriverAlert = hasEmergency || hasOverspeed || hasFatigue || 
                       hasDangerousDriving || hasOverspeedWarning || 
                       hasFatigueWarning;
```

### Method 2: Check Additional Info 0x18 (Detailed)

```typescript
// After parsing additional info fields
if (alert.drivingBehavior) {
  const hasFatigue = alert.drivingBehavior.fatigue;
  const hasPhoneCall = alert.drivingBehavior.phoneCall;
  const hasSmoking = alert.drivingBehavior.smoking;
  const fatigueLevel = alert.drivingBehavior.fatigueLevel;
  
  // Critical if fatigue level > 80
  if (fatigueLevel > 80) {
    console.log('🚨 CRITICAL: Severe driver fatigue');
  }
}
```

### Method 3: Check Video Alarm Flag 0x14

```typescript
// From additional info 0x14
if (alert.videoAlarms?.abnormalDriving) {
  console.log('🚨 Video analysis detected abnormal driving');
}
```

---

## 4. Current Implementation Verification

### ✅ What's Correctly Implemented:

```typescript
// alertParser.ts correctly parses:

// 1. Alarm flag (byte 0-3) ✅
const alarmFlag = body.readUInt32BE(0);

// 2. Additional info 0x18 (abnormal driving) ✅
case 0x18:
  alert.drivingBehavior = this.parseAbnormalDriving(infoData);
  // Extracts: fatigue, phoneCall, smoking, fatigueLevel

// 3. Additional info 0x14 (video alarms) ✅
case 0x14:
  alert.videoAlarms = this.parseVideoAlarms(infoData);
  // Extracts: abnormalDriving flag
```

### ❌ What's Missing:

```typescript
// Alarm flag is READ but NOT PARSED into individual bits
const alarmFlag = body.readUInt32BE(0);  // ✅ Read
// ❌ But individual alarm bits NOT extracted

// Should be:
const alarms = {
  emergency: !!(alarmFlag & (1 << 0)),
  overspeed: !!(alarmFlag & (1 << 1)),
  fatigue: !!(alarmFlag & (1 << 2)),
  dangerousDriving: !!(alarmFlag & (1 << 3)),
  // ... etc
};
```

---

## 5. Complete Driver Alert Detection

### Updated Interface:

```typescript
export interface AlarmFlags {
  emergency: boolean;
  overspeed: boolean;
  fatigue: boolean;
  dangerousDriving: boolean;
  overspeedWarning: boolean;
  fatigueWarning: boolean;
  collision: boolean;
  // ... other alarms
}

export interface LocationAlert {
  vehicleId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  direction: number;
  alarmFlags: AlarmFlags;  // ADD THIS
  videoAlarms?: VideoAlarmStatus;
  drivingBehavior?: AbnormalDrivingBehavior;
  // ... other fields
}
```

### Updated Parser:

```typescript
static parseLocationReport(body: Buffer, vehicleId: string): LocationAlert | null {
  if (body.length < 28) return null;

  // Parse alarm flag (byte 0-3)
  const alarmFlag = body.readUInt32BE(0);
  const alarmFlags: AlarmFlags = {
    emergency: !!(alarmFlag & (1 << 0)),
    overspeed: !!(alarmFlag & (1 << 1)),
    fatigue: !!(alarmFlag & (1 << 2)),
    dangerousDriving: !!(alarmFlag & (1 << 3)),
    overspeedWarning: !!(alarmFlag & (1 << 13)),
    fatigueWarning: !!(alarmFlag & (1 << 14)),
    collision: !!(alarmFlag & (1 << 31))
  };

  // Parse status flag (byte 4-7)
  const statusFlag = body.readUInt32BE(4);
  
  // Parse location data
  const latitude = body.readUInt32BE(8) / 1000000;
  const longitude = body.readUInt32BE(12) / 1000000;
  const altitude = body.readUInt16BE(16);
  const speed = body.readUInt16BE(18) / 10;  // Convert to km/h
  const direction = body.readUInt16BE(20);
  const timestamp = this.parseTimestamp(body.slice(22, 28));

  const alert: LocationAlert = {
    vehicleId,
    timestamp,
    latitude,
    longitude,
    altitude,
    speed,
    direction,
    alarmFlags  // ADD THIS
  };

  // Parse additional information (after byte 28)
  let offset = 28;
  while (offset < body.length - 2) {
    const infoId = body.readUInt8(offset);
    const infoLength = body.readUInt8(offset + 1);
    
    if (offset + 2 + infoLength > body.length) break;
    
    const infoData = buffer.slice(offset + 2, offset + 2 + infoLength);
    
    switch (infoId) {
      case 0x14: // Video alarms
        alert.videoAlarms = this.parseVideoAlarms(infoData);
        break;
      case 0x18: // Abnormal driving behavior
        alert.drivingBehavior = this.parseAbnormalDriving(infoData);
        break;
      // ... other cases
    }
    
    offset += 2 + infoLength;
  }

  return alert;
}
```

---

## 6. Driver Alert Priority Logic

### Updated Priority Determination:

```typescript
determinePriority(alert: LocationAlert): AlertPriority {
  // CRITICAL: Emergency or severe fatigue
  if (alert.alarmFlags.emergency) {
    return AlertPriority.CRITICAL;
  }
  
  if (alert.drivingBehavior?.fatigueLevel && 
      alert.drivingBehavior.fatigueLevel > 80) {
    return AlertPriority.CRITICAL;
  }
  
  // HIGH: Fatigue, dangerous driving, phone, smoking
  if (alert.alarmFlags.fatigue ||
      alert.alarmFlags.dangerousDriving ||
      alert.drivingBehavior?.fatigue ||
      alert.drivingBehavior?.phoneCall ||
      alert.drivingBehavior?.smoking) {
    return AlertPriority.HIGH;
  }
  
  // HIGH: Overspeed alarm (not warning)
  if (alert.alarmFlags.overspeed) {
    return AlertPriority.HIGH;
  }
  
  // MEDIUM: Warnings
  if (alert.alarmFlags.overspeedWarning ||
      alert.alarmFlags.fatigueWarning) {
    return AlertPriority.MEDIUM;
  }
  
  // MEDIUM: Video-detected abnormal driving
  if (alert.videoAlarms?.abnormalDriving) {
    return AlertPriority.MEDIUM;
  }
  
  return AlertPriority.LOW;
}
```

---

## 7. Real-World Example

### Packet with Driver Alert:

```
Hex: 00 00 00 04 00 00 00 00 01 C9 C3 80 06 7B 28 00
     00 64 03 20 00 5A 18 01 15 01 14 04 18 04 00 00 00 20
     18 03 01 00 55

Breakdown:
Byte 0-3:   00 00 00 04 = Alarm flag
            bit 2 = 1 → Fatigue driving alarm ✅

Byte 18-19: 03 20 = Speed (800 * 0.1 = 80 km/h)

Additional Info:
0x14: 00 00 00 20 = Video alarms
      bit 5 = 1 → Abnormal driving detected ✅

0x18: 01 00 55 = Abnormal driving behavior
      bit 0 = 1 → Fatigue ✅
      0x55 = 85 → Fatigue level 85% ✅
```

### Parser Output:

```typescript
{
  vehicleId: "221083666502",
  timestamp: Date(2018-01-15T01:14:04),
  latitude: 30.0,
  longitude: 109.0,
  altitude: 100,
  speed: 80,  // km/h
  direction: 90,
  alarmFlags: {
    fatigue: true,  // ✅ From alarm flag bit 2
    // ... other flags false
  },
  videoAlarms: {
    abnormalDriving: true,  // ✅ From 0x14 bit 5
  },
  drivingBehavior: {
    fatigue: true,          // ✅ From 0x18 bit 0
    fatigueLevel: 85        // ✅ From 0x18 byte 2
  }
}
```

### Alert Detection:

```typescript
// Multiple indicators confirm driver fatigue:
1. alarmFlags.fatigue = true (from main alarm flag)
2. videoAlarms.abnormalDriving = true (from video analysis)
3. drivingBehavior.fatigue = true (from detailed behavior)
4. drivingBehavior.fatigueLevel = 85 (CRITICAL level)

Priority: CRITICAL (fatigue level > 80)
Action: Immediate notification + screenshot + 30s video capture
```

---

## 8. Summary: How Driver Alerts Are Flagged

### Three-Level Detection System:

1. **Level 1: Alarm Flag (Byte 0-3)**
   - Primary indicator
   - Set by terminal hardware/firmware
   - Bits 0-3, 13-14 are driver-related
   - ✅ Currently READ but NOT parsed

2. **Level 2: Video Alarm (0x14)**
   - Set by video analysis AI
   - bit 5 = abnormal driving detected
   - ✅ Currently parsed correctly

3. **Level 3: Detailed Behavior (0x18)**
   - Specific behavior flags
   - Fatigue level (0-100)
   - ✅ Currently parsed correctly

### Required Fix:

**Add alarm flag parsing** to extract individual alarm bits from byte 0-3.

**Time to implement**: 30 minutes

**Lines of code**: ~20 lines

---

## 9. Verification Checklist

- [ ] Parse alarm flag bits (byte 0-3)
- [ ] Add AlarmFlags interface
- [ ] Update LocationAlert interface
- [ ] Add speed, direction, altitude to alert
- [ ] Update priority logic to use alarm flags
- [ ] Test with real packets
- [ ] Verify all three detection levels work

---

**Conclusion**: Your implementation correctly parses levels 2 and 3 (video alarms and detailed behavior). You just need to add level 1 (alarm flag bit parsing) to have complete driver alert detection. 🎯
