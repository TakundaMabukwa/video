const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const files = [
  'C:/Users/mabuk/Desktop/JT808-protocol for  -MettaX.pdf',
  'C:/Users/mabuk/Desktop/JTT1078-Protocol 2016 for Video--MettaX.pdf'
];

const patterns = [
  { key: 'msg_0900', re: /0x0900|data uplink pass-through|8\.62/gi },
  { key: 'pass_type_41_42', re: /0x41|0x42|serial port 1|serial port 2/gi },
  { key: 'pass_type_f0_ff', re: /0xF0-0xFF|0xF0 ~ 0xFF|user-defined pass-through/gi },
  { key: 'location_ext_custom', re: /0xE1-0xFF|custom area/gi },
  { key: 'video_table_38', re: /Table\s*38|0x0101|0x0102|0x0103|0x0104|0x0105|0x0106|0x0107/gi },
  { key: 'vendor_10001_11203', re: /\b10001\b|\b10002\b|\b10003\b|\b10004\b|\b10005\b|\b10006\b|\b10007\b|\b10008\b|\b10016\b|\b10017\b|\b10101\b|\b10102\b|\b10103\b|\b10104\b|\b10105\b|\b10106\b|\b10107\b|\b10116\b|\b10117\b|\b11201\b|\b11202\b|\b11203\b/gi }
];

function snippet(text, index, radius = 150) {
  const s = Math.max(0, index - radius);
  const e = Math.min(text.length, index + radius);
  return text.slice(s, e).replace(/\s+/g, ' ').trim();
}

async function analyze(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = parsed.text || '';
  const result = {
    file: filePath,
    pages: parsed.total || null,
    info: {},
    matches: {}
  };

  for (const p of patterns) {
    const matches = [];
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      matches.push({
        token: m[0],
        idx: m.index,
        context: snippet(text, m.index)
      });
      if (matches.length >= 30) break;
    }
    result.matches[p.key] = {
      count: matches.length,
      samples: matches
    };
  }

  return result;
}

function summarize(report) {
  const lines = [];
  lines.push(`# Protocol PDF Extraction Report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  for (const file of report.files) {
    lines.push(`## ${path.basename(file.file)}`);
    lines.push(`- Pages: ${file.pages}`);
    for (const [key, data] of Object.entries(file.matches)) {
      lines.push(`- ${key}: ${data.count}`);
      for (const s of data.samples.slice(0, 4)) {
        lines.push(`  - "${s.token}" :: ${s.context}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const reports = [];
  for (const f of files) {
    if (!fs.existsSync(f)) {
      reports.push({ file: f, error: 'missing' });
      continue;
    }
    try {
      reports.push(await analyze(f));
    } catch (e) {
      reports.push({ file: f, error: e.message || String(e) });
    }
  }

  const outDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'protocol-pdf-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ files: reports }, null, 2), 'utf8');

  const mdPath = path.join(outDir, 'protocol-pdf-report.md');
  const good = reports.filter((r) => !r.error);
  fs.writeFileSync(mdPath, summarize({ files: good }), 'utf8');

  console.log(`Wrote: ${jsonPath}`);
  console.log(`Wrote: ${mdPath}`);
  for (const r of reports) {
    if (r.error) console.log(`ERROR: ${r.file} -> ${r.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
