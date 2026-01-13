const SYNC = Buffer.from([0x30, 0x31, 0x63, 0x64]); // "30316364"
let buf = Buffer.alloc(0);

export function bcdToString6(b) {
  // 6 bytes BCD -> 12 digits (often SIM)
  return [...b].map(x => `${(x >> 4) & 0xf}${x & 0xf}`).join('');
}

export function onTcpData(chunk) {
  buf = Buffer.concat([buf, chunk]);

  while (true) {
    const i = buf.indexOf(SYNC);
    if (i === -1) {
      // keep last 3 bytes in case SYNC splits across chunks
      buf = buf.slice(Math.max(0, buf.length - 3));
      return;
    }
    if (i > 0) buf = buf.slice(i); // drop junk before sync
    if (buf.length < 18) return;   // not enough for smallest header

    // Fixed fields up to type/subpkg are available by offset 15.
    const flags4 = buf[4];         // V/P/X/CC
    const flags5 = buf[5];         // M + PT(7)
    const seq = buf.readUInt16BE(6);
    const sim = bcdToString6(buf.slice(8, 14));
    const channel = buf[14];

    const typeAndFrag = buf[15];
    const dataType = (typeAndFrag >> 4) & 0x0f;   // 0..4
    const fragFlag = typeAndFrag & 0x0f;          // 0..3 per spec

    // Header length depends on dataType per your document.
    // 0=I,1=P,2=B,3=audio,4=transparent
    let bodyLenOffset;
    if (dataType === 0x04) bodyLenOffset = 16;      // transparent: no timestamp
    else if (dataType === 0x03) bodyLenOffset = 24; // audio: timestamp, no intervals
    else bodyLenOffset = 28;                        // video: timestamp + intervals

    const minNeeded = bodyLenOffset + 2;
    if (buf.length < minNeeded) return;

    const bodyLen = buf.readUInt16BE(bodyLenOffset);
    const packetLen = (bodyLenOffset + 2) + bodyLen;

    if (buf.length < packetLen) return; // wait for more TCP data

    const body = buf.slice(bodyLenOffset + 2, packetLen);

    // TODO: reassemble complete frames using fragFlag + M-bit if needed
    // M-bit is top bit of flags5:
    const marker = (flags5 & 0x80) !== 0;
    const pt = flags5 & 0x7f;

    handlePayload({ seq, sim, channel, dataType, fragFlag, marker, pt, body });

    buf = buf.slice(packetLen); // consume one full packet and continue
  }
}
