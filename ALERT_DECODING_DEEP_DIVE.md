# Alert Decoding Deep Dive

## Do camera alerts come as words or binary?

They come on the wire as binary protocol fields.

Primary source (JT/T 1078 over JT/T 808):
- Message ID `0x0200` (location report)
- Additional info TLV fields:
  - `0x14` (DWORD): video alarm bit flags
  - `0x15` (DWORD): signal loss channel bits
  - `0x16` (DWORD): signal blocking channel bits
  - `0x17` (WORD): memory failure bits
  - `0x18` (WORD + optional BYTE): abnormal driving bits (+ fatigue level)

The "words" shown in UI are labels derived from those bits/codes.

## What we had wrong on the ground

We decoded `0x0200` correctly, but two other incoming alert-bearing paths were ACKed and discarded:
- `0x0800` multimedia event message
- `0x0704` custom/proprietary message

That caused missed alerts for devices that raise events there instead of (or before) `0x0200` extra fields.

## What is now implemented

### 1) External alert ingestion path
Added `AlertManager.processExternalAlert(...)` so non-`0x0200` alerts become first-class alerts with:
- DB persistence
- websocket broadcast
- screenshot request
- pre/post video capture flow
- escalation monitoring

### 2) `0x0800` multimedia event decoding
`src/tcp/server.ts` now parses:
- multimedia id/type/format/event code/channel
- maps event code to alert priority/type
- creates alerts for event codes `>= 2`

Current mapping:
- `2` -> `Emergency Alarm Trigger` (critical)
- `3` -> `Collision/Rollover Trigger` (critical)
- other `>=2` -> `Multimedia Alarm Event <code>` (medium)

### 3) `0x0704` custom text decoding
`src/tcp/server.ts` now:
- attempts best-effort payload text decode
- extracts keyword alerts (fatigue/smoking/phone/speed/camera covered/storage failure/gnss/emergency/collision)
- creates alerts with mapped priority

### 4) Better JT/T 808 alarm word labels
Expanded `jt808_alarm_bit_*` mapping in `src/alerts/alertManager.ts` so bits become meaningful words in UI/metadata.

## Files changed
- `src/alerts/alertManager.ts`
  - added `ExternalAlertInput`
  - added `processExternalAlert(...)`
  - added mappings for `external_multimedia_event_*`, `custom_keyword_*`
  - expanded `jt808_alarm_bit_*` label map
- `src/tcp/server.ts`
  - track last known location per vehicle
  - decode and process `0x0800` multimedia events
  - decode and process `0x0704` custom messages
  - feed last known lat/lon into external alerts

## Build status
- TypeScript build passes (`npm.cmd run build`).

## Quick validation checklist

1. Trigger/simulate alerts and watch logs:
- `0x0200` path: should still create alerts from `0x14..0x18` and alarm bits.
- `0x0800` path: should log multimedia event fields and create alerts for codes `>=2`.
- `0x0704` path: if payload has alert words, should create keyword-mapped alerts.

2. Check active alerts API:
- `GET /api/alerts/active`

3. Check websocket live stream:
- `ws://<server>:3000/ws/alerts`

4. Confirm DB inserts:
- new rows in `alerts` with external metadata (`sourceMessageId` in metadata).
