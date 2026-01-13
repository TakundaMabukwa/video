const WebSocket = require('ws');

const ws = new WebSocket('ws://164.90.182.2:3000/ws/data');

ws.on('open', () => console.log('Connected'));
ws.on('message', (data) => console.log('Received:', data.toString()));
ws.on('error', (error) => console.error('Error:', error.message));
ws.on('close', () => console.log('Disconnected'));
