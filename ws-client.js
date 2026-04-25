const WebSocket = require('ws');

const ws = new WebSocket('ws://209.38.206.44:7081/ws/data');

ws.on('open', () => console.log('Connected'));
ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('MSG:', JSON.stringify(msg));
  } catch {
    console.log('RAW:', data.toString('hex').slice(0, 64));
  }
});
ws.on('error', (e) => console.error('Error:', e.message));
ws.on('close', (code, reason) => console.log(`Disconnected: ${code} ${reason}`));
