// Simple test client to simulate AI camera
const net = require('net');
const dgram = require('dgram');

// Simulate JT/T 808 registration
function testTCPConnection() {
  const client = net.createConnection(7611, 'localhost');
  
  client.on('connect', () => {
    console.log('✅ TCP Connected to JT/T 808 server');
    
    // Send terminal registration (simplified)
    const regMsg = Buffer.from([
      0x7E, // Start flag
      0x01, 0x00, // Message ID (0x0100)
      0x00, 0x05, // Body length
      0x01, 0x23, 0x45, 0x67, 0x89, 0x01, // Phone number
      0x00, 0x01, // Serial number
      0x48, 0x65, 0x6C, 0x6C, 0x6F, // Body "Hello"
      0x13, // Checksum (example)
      0x7E  // End flag
    ]);
    
    client.write(regMsg);
    console.log('📤 Sent registration message');
  });
  
  client.on('data', (data) => {
    console.log('📥 Received response:', data.toString('hex'));
  });
}

// Simulate JT/T 1078 RTP packets
function testUDPStream() {
  const udpClient = dgram.createSocket('udp4');
  
  // Simulate RTP packet with JT/T 1078 header
  const rtpPacket = Buffer.alloc(32);
  rtpPacket.writeUInt32BE(0x30316364, 0); // Frame header
  rtpPacket.writeUInt8(0x80, 4);          // RTP version
  rtpPacket.writeUInt8(0x60, 5);          // Payload type
  rtpPacket.writeUInt16BE(1, 6);          // Sequence
  rtpPacket.writeUInt32BE(12345, 8);      // Timestamp
  rtpPacket.writeUInt32BE(0x12345678, 12); // SSRC
  rtpPacket.writeUInt8(1, 16);            // Channel 1
  rtpPacket.writeUInt8(0x00, 17);         // Atomic frame
  rtpPacket.writeUInt16BE(8, 18);         // Payload length
  
  // Fake H.264 payload
  rtpPacket.write('H264DATA', 20);
  
  udpClient.send(rtpPacket, 6611, 'localhost', (err) => {
    if (err) console.error('UDP send error:', err);
    else console.log('📤 Sent RTP packet');
    udpClient.close();
  });
}

// Run tests
console.log('🧪 Testing JT/T 1078 Server...\n');
testTCPConnection();
setTimeout(testUDPStream, 2000);