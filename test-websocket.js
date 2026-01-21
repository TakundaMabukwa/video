// WebSocket Connection Test Script
// Run with: node test-websocket.js

const WebSocket = require('ws');

const WS_URL = 'ws://164.90.182.2:3000/ws/alerts';

console.log('🔌 Testing WebSocket connection...');
console.log(`URL: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected successfully!');
  console.log('Waiting for messages...\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📨 Received message:');
    console.log(JSON.stringify(message, null, 2));
    console.log('');
  } catch (e) {
    console.log('📨 Received:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:');
  console.error(error.message);
  console.error('\nPossible causes:');
  console.error('1. Server not running on port 3000');
  console.error('2. Firewall blocking port 3000');
  console.error('3. Wrong URL or path');
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed`);
  console.log(`Code: ${code}`);
  console.log(`Reason: ${reason || 'none'}`);
  process.exit(0);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Test timeout (30s). Closing connection...');
  ws.close();
}, 30000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});
