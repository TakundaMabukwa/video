#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <ALERT_ID> [BASE_URL]"
  echo "Example: $0 ALT-1774992401772-22990 http://localhost:3000"
  exit 1
fi

ALERT_ID="$1"
BASE_URL="${2:-http://localhost:3000}"
ATTEMPTS="${ATTEMPTS:-12}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Checking alert evidence for ${ALERT_ID}"
echo "Base URL: ${BASE_URL}"
echo

for ((attempt=1; attempt<=ATTEMPTS; attempt++)); do
  MEDIA_JSON="${TMP_DIR}/media.json"
  VIDEOS_JSON="${TMP_DIR}/videos.json"
  SCREENS_JSON="${TMP_DIR}/screens.json"

  curl -fsS "${BASE_URL}/api/alerts/${ALERT_ID}/media" > "${MEDIA_JSON}" || true
  curl -fsS "${BASE_URL}/api/alerts/${ALERT_ID}/videos" > "${VIDEOS_JSON}" || true
  curl -fsS "${BASE_URL}/api/alerts/${ALERT_ID}/screenshots" > "${SCREENS_JSON}" || true

  python3 - "$MEDIA_JSON" "$VIDEOS_JSON" "$SCREENS_JSON" "$attempt" "$ATTEMPTS" <<'PY'
import json, sys

media_path, videos_path, screens_path, attempt, total = sys.argv[1:]

def load(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

media = load(media_path)
videos = load(videos_path)
screens = load(screens_path)

data = media.get("data") or {}
linked = data.get("linked") or {}
video_candidates = data.get("videos") or []
screen_candidates = data.get("screenshots") or []
videos_table = (videos.get("videos") or {}).get("database_records") or []
camera = (videos.get("videos") or {}).get("camera_sd") or {}
camera_pre = (videos.get("videos") or {}).get("camera_sd_pre") or {}
camera_post = (videos.get("videos") or {}).get("camera_sd_post") or {}
screen_count = ((screens.get("data") or {}).get("count")) or 0

usable = []
for item in video_candidates:
    size = int(item.get("fileSize") or 0)
    if size > 0:
        usable.append({
            "source": item.get("source") or item.get("label") or "video",
            "size": size,
            "url": item.get("url") or item.get("rawUrl") or item.get("storageUrl") or ""
        })
for item in videos_table:
    size = int(item.get("file_size") or 0)
    if size > 0:
        usable.append({
            "source": item.get("video_type") or "database_record",
            "size": size,
            "url": item.get("url") or item.get("storage_url") or item.get("file_path") or ""
        })

print(f"Attempt {attempt}/{total}")
print(f"  linked videos: {linked.get('videosLinked', 0)}")
print(f"  linked screenshots: {linked.get('screenshotsLinked', 0)}")
print(f"  screenshot count endpoint: {screen_count}")
print(f"  media videos returned: {len(video_candidates)}")
print(f"  db video records returned: {len(videos_table)}")
print(f"  camera video id: {camera.get('path') or '-'}")
print(f"  camera pre id: {camera_pre.get('path') or '-'}")
print(f"  camera post id: {camera_post.get('path') or '-'}")

if usable:
    best = sorted(usable, key=lambda item: item["size"], reverse=True)[0]
    print("  best usable clip:")
    print(f"    source: {best['source']}")
    print(f"    size: {best['size']}")
    print(f"    url: {best['url']}")
    print("READY")
else:
    print("PENDING")
PY

  STATUS="$(python3 - "$MEDIA_JSON" "$VIDEOS_JSON" <<'PY'
import json, sys
def load(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}
media = load(sys.argv[1])
videos = load(sys.argv[2])
data = media.get("data") or {}
linked = data.get("linked") or {}
video_candidates = data.get("videos") or []
videos_table = (videos.get("videos") or {}).get("database_records") or []
usable = any(int(item.get("fileSize") or 0) > 0 for item in video_candidates) or any(int(item.get("file_size") or 0) > 0 for item in videos_table)
print("ready" if usable or int(linked.get("videosLinked", 0)) > 0 else "pending")
PY
)"

  echo
  if [[ "${STATUS}" == "ready" ]]; then
    echo "Alert evidence is ready."
    exit 0
  fi

  if [[ "${attempt}" -lt "${ATTEMPTS}" ]]; then
    sleep "${SLEEP_SECONDS}"
  fi
done

echo "Alert evidence is still pending after ${ATTEMPTS} attempts."
exit 2
