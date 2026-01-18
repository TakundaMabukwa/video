#!/usr/bin/env node

// Quick verification test for live streaming setup

const WebSocket = require('ws');

console.log('🔍 JT/T 1078 Live Streaming Configuration Test\n');

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function test(name, fn) {
  try {
    fn();
    tests.passed++;
    tests.results.push(`✅ ${name}`);
  } catch (error) {
    tests.failed++;
    tests.results.push(`❌ ${name}: ${error.message}`);
  }
}

// Test 1: Check required files exist
test('LiveVideoStreamServer exists', () => {
  const fs = require('fs');
  if (!fs.existsSync('./dist/streaming/liveStream.js')) {
    throw new Error('liveStream.js not found - run npm run build');
  }
});

test('HTML client exists', () => {
  const fs = require('fs');
  if (!fs.existsSync('./public/live-stream.html')) {
    throw new Error('live-stream.html not found');
  }
});

// Test 2: Check UDP server has frame callback
test('UDP server has setFrameCallback', () => {
  const { UDPRTPServer } = require('./dist/udp/server');
  const udp = new UDPRTPServer(6611);
  if (typeof udp.setFrameCallback !== 'function') {
    throw new Error('setFrameCallback method missing');
  }
});

// Test 3: Check RTP parser returns dataType
test('RTP parser returns dataType', () => {
  const { JTT1078RTPParser } = require('./dist/udp/rtpParser');
  
  // Create minimal valid RTP packet
  const buffer = Buffer.alloc(50);
  buffer.writeUInt32BE(0x30316364, 0); // Frame header
  buffer.writeUInt8(0x80, 4); // RTP byte
  buffer.writeUInt8(0x00, 5); // Marker + PT
  buffer.writeUInt16BE(1, 6); // Sequence
  // SIM card (6 bytes BCD)
  for (let i = 8; i < 14; i++) buffer.writeUInt8(0x12, i);
  buffer.writeUInt8(1, 14); // Channel
  buffer.writeUInt8(0x00, 15); // Data type (0) + subpackage (0)
  buffer.writeUInt16BE(10, 28); // Payload length
  
  const result = JTT1078RTPParser.parseRTPPacket(buffer);
  if (!result || typeof result.dataType !== 'number') {
    throw new Error('dataType not returned from parser');
  }
});

// Test 4: Check frame assembler handles SPS/PPS
test('Frame assembler extracts SPS/PPS', () => {
  const { FrameAssembler } = require('./dist/udp/frameAssembler');
  const assembler = new FrameAssembler();
  
  // Create H.264 SPS NAL unit
  const spsFrame = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1E]);
  
  const header = {
    simCard: '123456789012',
    channelNumber: 1,
    subpackageFlag: 0, // ATOMIC
    sequenceNumber: 1,
    timestamp: BigInt(1000)
  };
  
  const result = assembler.assembleFrame(header, spsFrame, 0);
  if (!result) {
    throw new Error('Frame assembly failed');
  }
});

// Test 5: Check 0x9101 command structure
test('0x9101 command has correct structure', () => {
  const { JTT1078Commands } = require('./dist/tcp/commands');
  
  const cmd = JTT1078Commands.buildStartVideoCommand(
    '013912345678',
    1,
    '192.168.1.100',
    7611,
    6611,
    1,
    1,
    0
  );
  
  if (!Buffer.isBuffer(cmd)) {
    throw new Error('Command is not a Buffer');
  }
  
  // Check frame delimiters
  if (cmd[0] !== 0x7E || cmd[cmd.length - 1] !== 0x7E) {
    throw new Error('Missing frame delimiters');
  }
});

// Test 6: WebSocket server configuration
test('WebSocket paths configured', () => {
  const fs = require('fs');
  const indexContent = fs.readFileSync('./src/index.ts', 'utf8');
  
  if (!indexContent.includes('/ws/video')) {
    throw new Error('/ws/video path not configured');
  }
  
  if (!indexContent.includes('LiveVideoStreamServer')) {
    throw new Error('LiveVideoStreamServer not initialized');
  }
  
  if (!indexContent.includes('setFrameCallback')) {
    throw new Error('Frame callback not connected');
  }
});

// Test 7: Check ports configuration
test('Ports correctly configured', () => {
  const fs = require('fs');
  const indexContent = fs.readFileSync('./src/index.ts', 'utf8');
  
  if (!indexContent.includes('TCP_PORT') || !indexContent.includes('UDP_PORT')) {
    throw new Error('Port constants not defined');
  }
});

// Print results
console.log('\n' + '='.repeat(50));
console.log('Test Results:');
console.log('='.repeat(50));
tests.results.forEach(r => console.log(r));
console.log('='.repeat(50));
console.log(`\nPassed: ${tests.passed}/${tests.passed + tests.failed}`);

if (tests.failed > 0) {
  console.log('\n❌ Some tests failed. Please fix the issues above.');
  process.exit(1);
} else {
  console.log('\n✅ All configuration tests passed!');
  console.log('\n📋 Next Steps:');
  console.log('1. npm start');
  console.log('2. Open http://localhost:3000/live-stream.html');
  console.log('3. Connect camera to TCP 7611');
  console.log('4. Subscribe to vehicle stream');
  console.log('5. Watch live video frames arrive!\n');
  process.exit(0);
}
