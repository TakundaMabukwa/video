import * as fs from 'fs';
import * as path from 'path';

export interface ArchivedFrame {
  timestampMs: number;
  isIFrame: boolean;
  data: Buffer;
}

const MAGIC = Buffer.from('FARC1', 'ascii');

export function writeFrameArchive(filePath: string, frames: ArchivedFrame[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const parts: Buffer[] = [];
  const count = Buffer.allocUnsafe(4);
  count.writeUInt32BE(frames.length, 0);
  parts.push(MAGIC, count);

  for (const f of frames) {
    const head = Buffer.allocUnsafe(8 + 1 + 4);
    head.writeBigInt64BE(BigInt(Math.max(0, Math.floor(f.timestampMs))), 0);
    head.writeUInt8(f.isIFrame ? 1 : 0, 8);
    head.writeUInt32BE(f.data.length >>> 0, 9);
    parts.push(head, f.data);
  }

  fs.writeFileSync(filePath, Buffer.concat(parts));
}

export function readFrameArchive(filePath: string): ArchivedFrame[] {
  const raw = fs.readFileSync(filePath);
  if (raw.length < 9 || !raw.subarray(0, 5).equals(MAGIC)) {
    throw new Error('Invalid frame archive magic');
  }
  let offset = 5;
  const count = raw.readUInt32BE(offset);
  offset += 4;

  const frames: ArchivedFrame[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 13 > raw.length) break;
    const timestampMs = Number(raw.readBigInt64BE(offset));
    offset += 8;
    const isIFrame = raw.readUInt8(offset) === 1;
    offset += 1;
    const len = raw.readUInt32BE(offset);
    offset += 4;
    if (offset + len > raw.length) break;
    const data = Buffer.from(raw.subarray(offset, offset + len));
    offset += len;
    frames.push({ timestampMs, isIFrame, data });
  }
  return frames;
}

export function archiveToRawH264(archivePath: string, outPath: string): string {
  const srcStat = fs.statSync(archivePath);
  if (fs.existsSync(outPath)) {
    const outStat = fs.statSync(outPath);
    if (outStat.size > 0 && outStat.mtimeMs >= srcStat.mtimeMs) {
      return outPath;
    }
  }

  const frames = readFrameArchive(archivePath);
  const payload = Buffer.concat(frames.map((f) => f.data));
  fs.writeFileSync(outPath, payload);
  return outPath;
}
