const DEFAULT_TERMINAL_TIMEZONE = "Africa/Johannesburg";
const DEFAULT_TERMINAL_OFFSET_HOURS = 2;

const KNOWN_TIMEZONE_OFFSETS: Record<string, number> = {
  "africa/johannesburg": 2,
  "africa/harare": 2,
  "africa/maputo": 2,
  utc: 0,
};

function parseOffsetHours(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;

  const normalized = raw.toLowerCase();
  if (KNOWN_TIMEZONE_OFFSETS[normalized] !== undefined) {
    return KNOWN_TIMEZONE_OFFSETS[normalized];
  }

  const offsetMatch = normalized.match(/^utc\s*([+-]\d{1,2})(?::?(\d{2}))?$/);
  if (!offsetMatch) return null;

  const hours = Number(offsetMatch[1]);
  const minutes = Number(offsetMatch[2] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const sign = hours < 0 ? -1 : 1;
  return hours + sign * (minutes / 60);
}

export function resolveTerminalTimezoneOffsetHours(): number {
  const configuredOffset =
    parseOffsetHours(process.env.JTT808_TERMINAL_TZ_OFFSET_HOURS) ??
    parseOffsetHours(process.env.TERMINAL_TZ_OFFSET_HOURS);

  if (configuredOffset !== null) {
    return configuredOffset;
  }

  const configuredTimezone =
    process.env.JTT808_TERMINAL_TIMEZONE ??
    process.env.TERMINAL_TIMEZONE ??
    DEFAULT_TERMINAL_TIMEZONE;

  return parseOffsetHours(configuredTimezone) ?? DEFAULT_TERMINAL_OFFSET_HOURS;
}
