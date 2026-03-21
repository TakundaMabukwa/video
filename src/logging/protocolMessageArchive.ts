import * as fs from 'fs';
import * as path from 'path';

type ProtocolArchiveRow = {
  ts: string;
  direction: 'inbound' | 'outbound';
  remoteAddress?: string | null;
  remotePort?: number | null;
  vehicleId?: string | null;
  messageId?: number | null;
  messageIdHex?: string | null;
  serialNumber?: number | null;
  bodyLength?: number | null;
  isSubpackage?: boolean;
  packetCount?: number | null;
  packetIndex?: number | null;
  parseSuccess?: boolean | null;
  parseError?: string | null;
  rawFrameHex: string;
  bodyHex?: string;
  bodyTextPreview?: string;
  parse?: Record<string, unknown>;
};

export class ProtocolMessageArchive {
  private static readonly dirPath = path.join(process.cwd(), 'logs');
  private static readonly filePath = path.join(ProtocolMessageArchive.dirPath, 'protocol-messages.ndjson');
  private static readonly enabled = ProtocolMessageArchive.resolveEnabled();

  private static resolveEnabled(): boolean {
    const explicit = String(process.env.PROTOCOL_FILE_ARCHIVE_ENABLED ?? 'true').trim().toLowerCase();
    return !['0', 'false', 'no', 'off'].includes(explicit);
  }

  private static ensureReady(): void {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8');
    }
  }

  static write(row: ProtocolArchiveRow): void {
    if (!this.enabled) return;
    try {
      this.ensureReady();
      fs.appendFile(
        this.filePath,
        `${JSON.stringify(row)}\n`,
        'utf8',
        () => {}
      );
    } catch {
      // Never throw from archive path.
    }
  }

  static getPath(): string {
    return this.filePath;
  }
}
