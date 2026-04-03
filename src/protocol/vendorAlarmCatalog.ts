export type VendorAlarmDomain = 'PLATFORM_VIDEO' | 'ADAS' | 'DMS' | 'BEHAVIOR';
export type VendorAlarmPriority = 'low' | 'medium' | 'high' | 'critical';

export type VendorAlarmEntry = {
  code: number;
  type: string;
  signalCode: string;
  domain: VendorAlarmDomain;
  defaultPriority: VendorAlarmPriority;
  meaning: string;
  sourceRef: string;
};

const BASE_VENDOR_ALARM_CATALOG: VendorAlarmEntry[] = [
  {
    code: 0x0101,
    type: 'Video Signal Lost',
    signalCode: 'platform_video_alarm_0101',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0101 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0102,
    type: 'Video Signal Occlusion',
    signalCode: 'platform_video_alarm_0102',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0102 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0103,
    type: 'Storage Failure',
    signalCode: 'platform_video_alarm_0103',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0103 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0104,
    type: 'Other Video Equipment Failure',
    signalCode: 'platform_video_alarm_0104',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0104 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0105,
    type: 'Passenger Overload',
    signalCode: 'platform_video_alarm_0105',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0105 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0106,
    type: 'Abnormal Driving Behavior',
    signalCode: 'platform_video_alarm_0106',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'high',
    meaning: 'Platform-level video alarm code 0x0106 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 0x0107,
    type: 'Special Alarm Recording Threshold',
    signalCode: 'platform_video_alarm_0107',
    domain: 'PLATFORM_VIDEO',
    defaultPriority: 'medium',
    meaning: 'Platform-level video alarm code 0x0107 reported.',
    sourceRef: 'JT/T 1078 Table 38'
  },
  {
    code: 10001,
    type: 'ADAS: Forward Collision Alert',
    signalCode: 'adas_10001_forward_collision_warning',
    domain: 'ADAS',
    defaultPriority: 'critical',
    meaning: 'Forward collision warning event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10002,
    type: 'ADAS: Lane Departure Alert',
    signalCode: 'adas_10002_lane_departure_alarm',
    domain: 'ADAS',
    defaultPriority: 'high',
    meaning: 'Lane departure event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10003,
    type: 'ADAS: Too Close Distance Alert',
    signalCode: 'adas_10003_following_distance_too_close',
    domain: 'ADAS',
    defaultPriority: 'high',
    meaning: 'Following distance too close event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10004,
    type: 'ADAS: Pedestrian Collision Alert',
    signalCode: 'adas_10004_pedestrian_collision_alarm',
    domain: 'ADAS',
    defaultPriority: 'critical',
    meaning: 'Pedestrian collision warning event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10005,
    type: 'ADAS: Frequent Lane Change Alert',
    signalCode: 'adas_10005_frequent_lane_change_alarm',
    domain: 'ADAS',
    defaultPriority: 'high',
    meaning: 'Frequent lane change event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10006,
    type: 'ADAS: Road Sign Exceedance Alert',
    signalCode: 'adas_10006_road_sign_over_limit_alarm',
    domain: 'ADAS',
    defaultPriority: 'medium',
    meaning: 'Road sign over-limit event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10007,
    type: 'ADAS: Obstacle Alert',
    signalCode: 'adas_10007_obstruction_alarm',
    domain: 'ADAS',
    defaultPriority: 'medium',
    meaning: 'Obstruction event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10008,
    type: 'ADAS: Driver assistance function failure alarm',
    signalCode: 'adas_10008_driver_assist_function_failure',
    domain: 'ADAS',
    defaultPriority: 'medium',
    meaning: 'Driver assistance function failure event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10016,
    type: 'ADAS: Road Sign Recognition Event',
    signalCode: 'adas_10016_road_sign_identification_event',
    domain: 'ADAS',
    defaultPriority: 'low',
    meaning: 'Road sign identification event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10017,
    type: 'ADAS: Active Snapshot Event',
    signalCode: 'adas_10017_active_capture_event',
    domain: 'ADAS',
    defaultPriority: 'low',
    meaning: 'Active capture event reported by ADAS.',
    sourceRef: 'Vendor ADAS code list'
  },
  {
    code: 10018,
    type: 'ADAS: Solid line lane change alarm',
    signalCode: 'adas_10018_solid_line_lane_change_alarm',
    domain: 'ADAS',
    defaultPriority: 'high',
    meaning: 'Solid line lane change event reported by ADAS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x64'
  },
  {
    code: 10019,
    type: 'ADAS: Aisle pedestrian detection alarm',
    signalCode: 'adas_10019_aisle_pedestrian_detection_alarm',
    domain: 'ADAS',
    defaultPriority: 'medium',
    meaning: 'Aisle pedestrian detection event reported by ADAS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x64'
  },
  {
    code: 10101,
    type: 'DMS: Fatigue Driving Alert',
    signalCode: 'dms_10101_fatigue_driving_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Fatigue driving event reported by DMS.',
    sourceRef: 'Vendor DMS code list'
  },
  {
    code: 10102,
    type: 'DMS: Calling Alert',
    signalCode: 'dms_10102_handheld_phone_use_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Handheld phone usage event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10103,
    type: 'DMS: Smoking Alert',
    signalCode: 'dms_10103_smoking_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Smoking event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10104,
    type: 'DMS: Distracted Driving Alert',
    signalCode: 'dms_10104_not_looking_forward_alarm',
    domain: 'DMS',
    defaultPriority: 'medium',
    meaning: 'Driver not looking forward event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10105,
    type: 'DMS: No Driver Detected',
    signalCode: 'dms_10105_driver_abnormal_alarm',
    domain: 'DMS',
    defaultPriority: 'medium',
    meaning: 'Driver abnormal event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10106,
    type: 'DMS: Hand Off Detection (HOD)',
    signalCode: 'dms_10106_camera_covered_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Driver monitoring camera covered event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10107,
    type: 'DMS: Infrared Blocking',
    signalCode: 'dms_10107_behavior_monitoring_failure',
    domain: 'DMS',
    defaultPriority: 'medium',
    meaning: 'Driver behavior monitoring function failure event reported by DMS.',
    sourceRef: 'Vendor DMS code list'
  },
  {
    code: 10108,
    type: 'DMS: Seat-Belt Detection',
    signalCode: 'dms_10108_overtime_driving_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Overtime driving event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10110,
    type: 'DMS: Driver ID Detection',
    signalCode: 'dms_10110_seatbelt_not_fastened_alarm',
    domain: 'DMS',
    defaultPriority: 'medium',
    meaning: 'Seatbelt not fastened event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10111,
    type: 'DMS: Infrared-blocking sunglasses failure alarm',
    signalCode: 'dms_10111_infrared_sunglasses_failure_alarm',
    domain: 'DMS',
    defaultPriority: 'medium',
    meaning: 'Infrared-blocking sunglasses failure event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10112,
    type: 'DMS: Hands off wheel alarm',
    signalCode: 'dms_10112_hands_off_wheel_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Both hands off the steering wheel event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10113,
    type: 'DMS: Play Phone',
    signalCode: 'dms_10113_playing_with_phone_alarm',
    domain: 'DMS',
    defaultPriority: 'high',
    meaning: 'Playing with phone event reported by DMS.',
    sourceRef: 'SmallChi JT808 YueBiao 0x65'
  },
  {
    code: 10116,
    type: 'DMS: Automatic Snapshot Event',
    signalCode: 'dms_10116_automatic_capture_event',
    domain: 'DMS',
    defaultPriority: 'low',
    meaning: 'Automatic capture event reported by DMS.',
    sourceRef: 'Vendor DMS code list'
  },
  {
    code: 10117,
    type: 'DMS: Driver change',
    signalCode: 'dms_10117_driver_change',
    domain: 'DMS',
    defaultPriority: 'low',
    meaning: 'Driver change event reported by DMS.',
    sourceRef: 'Vendor DMS code list'
  },
  {
    code: 11201,
    type: 'Rapid acceleration',
    signalCode: 'behavior_11201_rapid_acceleration',
    domain: 'BEHAVIOR',
    defaultPriority: 'medium',
    meaning: 'Rapid acceleration event reported by behavior analysis.',
    sourceRef: 'Vendor behavior code list'
  },
  {
    code: 11202,
    type: 'Rapid deceleration',
    signalCode: 'behavior_11202_rapid_deceleration',
    domain: 'BEHAVIOR',
    defaultPriority: 'medium',
    meaning: 'Rapid deceleration event reported by behavior analysis.',
    sourceRef: 'Vendor behavior code list'
  },
  {
    code: 11203,
    type: 'Sharp turn',
    signalCode: 'behavior_11203_sharp_turn',
    domain: 'BEHAVIOR',
    defaultPriority: 'medium',
    meaning: 'Sharp turn event reported by behavior analysis.',
    sourceRef: 'Vendor behavior code list'
  }
];

const parsePriority = (value: string): VendorAlarmPriority | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'low') return 'low';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'high') return 'high';
  if (normalized === 'critical') return 'critical';
  return null;
};

const parsePriorityOverrides = (): Map<number, VendorAlarmPriority> => {
  const raw = String(process.env.VENDOR_ALARM_PRIORITY_OVERRIDES || '').trim();
  const out = new Map<number, VendorAlarmPriority>();
  if (!raw) return out;

  for (const token of raw.split(',')) {
    const item = token.trim();
    if (!item) continue;
    const [codeRaw, prRaw] = item.split(':').map((v) => v.trim());
    if (!codeRaw || !prRaw) continue;
    const code = codeRaw.toLowerCase().startsWith('0x')
      ? parseInt(codeRaw, 16)
      : parseInt(codeRaw, 10);
    const pr = parsePriority(prRaw);
    if (!Number.isFinite(code) || !pr) continue;
    out.set(code, pr);
  }
  return out;
};

const priorityOverrides = parsePriorityOverrides();

export const getVendorAlarmCatalog = (): VendorAlarmEntry[] => {
  return BASE_VENDOR_ALARM_CATALOG.map((item) => ({
    ...item,
    defaultPriority: priorityOverrides.get(item.code) || item.defaultPriority
  }));
};

export const getVendorAlarmByCode = (
  code: number,
  options?: { allowPlatformVideoCodes?: boolean }
): VendorAlarmEntry | null => {
  const allowPlatformVideoCodes = options?.allowPlatformVideoCodes ?? true;
  const match = getVendorAlarmCatalog().find((item) => item.code === code) || null;
  if (!match) return null;
  if (!allowPlatformVideoCodes && match.domain === 'PLATFORM_VIDEO') return null;
  return match;
};

export const getVendorAlarmBySignalCode = (signalCode: string): VendorAlarmEntry | null => {
  return getVendorAlarmCatalog().find((item) => item.signalCode === signalCode) || null;
};

const OFFICIAL_STRUCTURED_ALERT_NAMES: Record<'ADAS' | 'DMS', Record<number, string>> = {
  ADAS: {
    1: 'ADAS: Forward Collision Alert',
    2: 'ADAS: Lane Departure Alert',
    3: 'ADAS: Too Close Distance Alert',
    4: 'ADAS: Pedestrian Collision Alert',
    5: 'ADAS: Frequent Lane Change Alert',
    6: 'ADAS: Road Sign Exceedance Alert',
    7: 'ADAS: Obstacle Alert',
    16: 'ADAS: Road Sign Recognition Event',
    17: 'ADAS: Active Snapshot Event',
  },
  DMS: {
    1: 'DMS: Fatigue Driving Alert',
    2: 'DMS: Calling Alert',
    3: 'DMS: Smoking Alert',
    4: 'DMS: Distracted Driving Alert',
    5: 'DMS: Driver Abnormality Alert',
    6: 'DMS: Steering Wheel Alert',
    7: 'DMS: Infrared Blocking',
    8: 'DMS: Seat Belt Alert',
    10: 'DMS: Device Blocking',
    13: 'DMS: Play Phone',
    16: 'DMS: Automatic Snapshot Event',
    17: 'DMS: Driver Change Event',
  }
};

const OFFICIAL_ALERT_NAME_ALIASES: Record<string, string> = {
  'driver fatigue': 'Fatigue Driving Alert',
  'fatigue driving alarm': 'Fatigue Driving Alert',
  'fatigue driving alert': 'Fatigue Driving Alert',
  'dms: fatigue driving alarm': 'DMS: Fatigue Driving Alert',
  'dms: fatigue alert': 'DMS: Fatigue Driving Alert',
  'phone call while driving': 'Calling Alert',
  'dms: handheld phone use alarm': 'DMS: Calling Alert',
  'dms: handheld phone alarm': 'DMS: Calling Alert',
  'dms: phone calling': 'DMS: Calling Alert',
  'smoking while driving': 'Smoking Alert',
  'dms: smoking alarm': 'DMS: Smoking Alert',
  'dms: smoking': 'DMS: Smoking Alert',
  'adas: forward collision warning': 'ADAS: Forward Collision Alert',
  'adas: lane departure alarm': 'ADAS: Lane Departure Alert',
  'adas: following distance too close': 'ADAS: Too Close Distance Alert',
  'adas: pedestrian collision alarm': 'ADAS: Pedestrian Collision Alert',
  'adas: frequent lane change alarm': 'ADAS: Frequent Lane Change Alert',
  'adas: road sign over-limit alarm': 'ADAS: Road Sign Exceedance Alert',
  'adas: obstruction alarm': 'ADAS: Obstacle Alert',
  'adas: road sign identification event': 'ADAS: Road Sign Recognition Event',
  'adas: active capture event': 'ADAS: Active Snapshot Event',
  'dms: not looking forward alarm': 'DMS: Distracted Driving Alert',
  'dms: distracted driving': 'DMS: Distracted Driving Alert',
  'dms: distracted driving alert': 'DMS: Distracted Driving Alert',
  'dms: driver abnormal alarm': 'DMS: Driver Abnormality Alert',
  'dms: driver behavior monitoring failure': 'DMS: Infrared Blocking',
  'dms: seatbelt not fastened alarm': 'DMS: Seat Belt Alert',
  'dms: automatic capture event': 'DMS: Automatic Snapshot Event',
  'dms: playing with phone alarm': 'DMS: Play Phone',
  'phone calling': 'Calling Alert',
  'play phone': 'Play Phone',
  'infrared blocking': 'Infrared Blocking',
  'video signal loss': 'Video Signal Lost',
  'video signal lost': 'Video Signal Lost',
  'video signal blocking': 'Video Signal Occlusion',
  'video signal occlusion': 'Video Signal Occlusion',
  'storage unit failure': 'Storage Failure',
  'bus overcrowding': 'Passenger Overload'
};

export const normalizeOfficialAlertType = (raw: string): string => {
  const value = String(raw || '').trim();
  if (!value) return 'Unknown alert';
  return OFFICIAL_ALERT_NAME_ALIASES[value.toLowerCase()] || value;
};

export const getOfficialStructuredAlertType = (
  domain: 'ADAS' | 'DMS',
  eventType: number,
  options?: { level?: number | null }
): string | null => {
  const base = OFFICIAL_STRUCTURED_ALERT_NAMES[domain]?.[eventType];
  if (!base) return null;
  const level = options?.level ?? null;
  if (!Number.isFinite(level) || level === null) return base;
  return `${base} (Level ${level})`;
};

export const resolveOfficialAlertType = (input: {
  alertType?: string;
  signalCode?: string;
  metadata?: any;
}): string => {
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const candidates = [
    input.signalCode,
    metadata?.alertSignalDetails?.[0]?.code,
    metadata?.alertSignals?.[0]
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const signalCode of candidates) {
    const structuredMatch = signalCode.match(/^(adas|dms)_event_type_(\d+)(?:_level_(\d+))?$/i);
    if (structuredMatch) {
      const domain = structuredMatch[1].toUpperCase() as 'ADAS' | 'DMS';
      const eventType = Number(structuredMatch[2]);
      const level = structuredMatch[3] ? Number(structuredMatch[3]) : null;
      const resolved = getOfficialStructuredAlertType(domain, eventType, { level });
      if (resolved) return resolved;
    }
    const vendor = getVendorAlarmBySignalCode(signalCode);
    if (vendor?.type) return normalizeOfficialAlertType(vendor.type);
  }

  const typeCandidates = [
    input.alertType,
    metadata?.primaryAlertType
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of typeCandidates) {
    const normalized = normalizeOfficialAlertType(candidate);
    if (normalized) return normalized;
  }

  return 'Unknown alert';
};

export const getKnownVendorCodes = (): Set<number> => {
  return new Set<number>(getVendorAlarmCatalog().map((item) => item.code));
};

const STRUCTURED_ACTIVE_SAFETY_EVENT_CODE_MAP: Record<'ADAS' | 'DMS', Record<number, number>> = {
  ADAS: {
    1: 10001,
    2: 10002,
    3: 10003,
    4: 10004,
    5: 10005,
    6: 10006,
    7: 10007,
    8: 10008,
    16: 10016,
    17: 10017,
    18: 10018,
    19: 10019
  },
  DMS: {
    1: 10101,
    2: 10102,
    3: 10103,
    4: 10104,
    5: 10105,
    6: 10106,
    8: 10108,
    10: 10110,
    11: 10111,
    12: 10112,
    13: 10113,
    16: 10116,
    17: 10117
  }
};

export const getVendorAlarmByStructuredEvent = (
  domain: 'ADAS' | 'DMS',
  eventType: number
): VendorAlarmEntry | null => {
  const code = STRUCTURED_ACTIVE_SAFETY_EVENT_CODE_MAP[domain]?.[eventType];
  if (!Number.isFinite(code)) return null;
  return getVendorAlarmByCode(code, { allowPlatformVideoCodes: false });
};
