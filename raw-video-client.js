const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const RAW_VIDEO_WS_URL =
  process.env.RAW_VIDEO_WS_URL || 'ws://209.38.206.44:3000/ws/raw'
const RECONNECT_DELAY_MS = Number(process.env.RAW_VIDEO_WS_RECONNECT_MS || 3000)
const VEHICLE_FILTER = (process.env.RAW_VIDEO_VEHICLE_ID || '').trim()
const RAW_PRINT_MODE = String(process.env.RAW_VIDEO_PRINT_MODE || 'summary')
  .trim()
  .toLowerCase()
const PRINT_PAYLOAD_LIMIT = Number(process.env.RAW_VIDEO_PRINT_LIMIT || 240)
const logsDir = path.join(__dirname, 'logs')
const outputFile = path.join(logsDir, 'raw-video-client.ndjson')
const textOutputFile = path.join(logsDir, 'raw-video-client.txt')

fs.mkdirSync(logsDir, { recursive: true })

let reconnectTimer = null

function appendLine(payload) {
  try {
    fs.appendFileSync(outputFile, JSON.stringify(payload) + '\n')
  } catch (error) {
    console.error('Failed to write client raw-video log:', error.message)
  }
}

function appendVehicleLine(vehicleId, payload) {
  try {
    const safeVehicleId = String(vehicleId || 'unknown')
    const perVehicleFile = path.join(logsDir, `raw-video-${safeVehicleId}.ndjson`)
    fs.appendFileSync(perVehicleFile, JSON.stringify(payload) + '\n')
  } catch (error) {
    console.error('Failed to write per-vehicle raw-video log:', error.message)
  }
}

function appendTextLine(text) {
  try {
    fs.appendFileSync(textOutputFile, text + '\n')
  } catch (error) {
    console.error('Failed to write client raw-video text log:', error.message)
  }
}

function appendVehicleTextLine(vehicleId, text) {
  try {
    const safeVehicleId = String(vehicleId || 'unknown')
    const perVehicleTextFile = path.join(
      logsDir,
      `raw-video-${safeVehicleId}.txt`,
    )
    fs.appendFileSync(perVehicleTextFile, text + '\n')
  } catch (error) {
    console.error('Failed to write per-vehicle raw-video text log:', error.message)
  }
}

function vehicleMatches(payload) {
  if (!VEHICLE_FILTER) return true
  return String(payload.vehicleId || '') === VEHICLE_FILTER
}

function clip(value) {
  const text = String(value || '')
  if (text.length <= PRINT_PAYLOAD_LIMIT) return text
  return `${text.slice(0, PRINT_PAYLOAD_LIMIT)}...`
}

function formatTextLine(payload) {
  if (payload.type === 'VIDEO_PACKET_RAW') {
    return JSON.stringify({
      type: payload.type,
      vehicleId: payload.vehicleId,
      channel: payload.channel,
      timestamp: payload.timestamp,
      size: payload.size,
      encoding: payload.encoding,
      payload: payload.payload,
    })
  }

  if (payload.type === 'VIDEO_FRAME_RAW') {
    return JSON.stringify({
      type: payload.type,
      vehicleId: payload.vehicleId,
      channel: payload.channel,
      transport: payload.transport,
      timestamp: payload.timestamp,
      isIFrame: payload.isIFrame,
      size: payload.size,
      encoding: payload.encoding,
      assembledPayload: payload.assembledPayload,
    })
  }

  return JSON.stringify(payload)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY_MS)
}

function connect() {
  console.log(`Connecting to ${RAW_VIDEO_WS_URL}`)
  const ws = new WebSocket(RAW_VIDEO_WS_URL)

  ws.on('open', () => {
    console.log('Connected to raw video websocket')
  })

  ws.on('message', (data) => {
    const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)

    try {
      const payload = JSON.parse(raw)
      appendLine(payload)
      appendTextLine(formatTextLine(payload))
      if (payload.vehicleId) {
        appendVehicleLine(payload.vehicleId, payload)
        appendVehicleTextLine(payload.vehicleId, formatTextLine(payload))
      }

      if (payload.type === 'hello') {
        console.log(
          `hello stream=${payload.stream} encoding=${payload.encoding}`,
        )
        return
      }

      if (!vehicleMatches(payload)) {
        return
      }

      if (payload.type === 'VIDEO_FRAME_RAW') {
        if (RAW_PRINT_MODE === 'raw') {
          console.log(
            JSON.stringify(
              {
                type: payload.type,
                vehicleId: payload.vehicleId,
                channel: payload.channel,
                transport: payload.transport,
                timestamp: payload.timestamp,
                isIFrame: payload.isIFrame,
                size: payload.size,
                encoding: payload.encoding,
                assembledPayload: clip(payload.assembledPayload),
              },
              null,
              2,
            ),
          )
        } else {
          console.log(
            `frame vehicle=${payload.vehicleId} ch=${payload.channel} transport=${payload.transport} size=${payload.size} iframe=${payload.isIFrame}`,
          )
        }
        return
      }

      if (payload.type === 'VIDEO_PACKET_RAW') {
        if (RAW_PRINT_MODE === 'raw') {
          console.log(
            JSON.stringify(
              {
                type: payload.type,
                vehicleId: payload.vehicleId,
                channel: payload.channel,
                timestamp: payload.timestamp,
                size: payload.size,
                encoding: payload.encoding,
                payload: clip(payload.payload),
              },
              null,
              2,
            ),
          )
        } else {
          console.log(
            `packet vehicle=${payload.vehicleId} ch=${payload.channel} size=${payload.size}`,
          )
        }
        return
      }

      console.log('message', payload.type || 'unknown')
    } catch {
      appendLine({
        type: 'RAW_TEXT_MESSAGE',
        ts: new Date().toISOString(),
        raw,
      })
      console.log('non-json message received')
    }
  })

  ws.on('close', (code, reason) => {
    const reasonText =
      reason && reason.length ? reason.toString() : 'no reason provided'
    console.log(`Disconnected: ${code} ${reasonText}`)
    scheduleReconnect()
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message)
  })
}

connect()
