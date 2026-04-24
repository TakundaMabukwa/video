const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')

const RAW_VIDEO_WS_URL =
  process.env.RAW_VIDEO_WS_URL || 'ws://127.0.0.1:3000/ws/raw'
const RECONNECT_DELAY_MS = Number(process.env.RAW_VIDEO_WS_RECONNECT_MS || 3000)
const logsDir = path.join(__dirname, 'logs')
const outputFile = path.join(logsDir, 'raw-video-client.ndjson')

fs.mkdirSync(logsDir, { recursive: true })

let reconnectTimer = null

function appendLine(payload) {
  try {
    fs.appendFileSync(outputFile, JSON.stringify(payload) + '\n')
  } catch (error) {
    console.error('Failed to write client raw-video log:', error.message)
  }
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

      if (payload.type === 'hello') {
        console.log(
          `hello stream=${payload.stream} encoding=${payload.encoding}`,
        )
        return
      }

      if (payload.type === 'VIDEO_FRAME_RAW') {
        console.log(
          `frame vehicle=${payload.vehicleId} ch=${payload.channel} transport=${payload.transport} size=${payload.size} iframe=${payload.isIFrame}`,
        )
        return
      }

      if (payload.type === 'VIDEO_PACKET_RAW') {
        console.log(
          `packet vehicle=${payload.vehicleId} ch=${payload.channel} size=${payload.size}`,
        )
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
