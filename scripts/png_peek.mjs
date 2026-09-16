/**
 * PNG 小工具 —— 验收 App Store 截图时用，不依赖任何 npm 包。
 *
 *   # 量尺寸 / 色彩类型 / 体积（一次看一套）
 *   node scripts/png_peek.mjs scan appstore-screenshots/iphone-6.5/*.png
 *
 *   # 裁一小块并放大，用来肉眼核验状态栏、刘海、图标这些几 pt 的细节
 *   node scripts/png_peek.mjs crop <in.png> <out.png> <x> <y> <w> <h> [scale=1]
 *
 *   # 量「自绘键盘的深灰面板」某一行的 x 覆盖范围（验证键盘是否铺满屏宽）
 *   node scripts/png_peek.mjs bars <in.png> [色值hex=403f44] [容差=12]
 *
 * 只支持 8bit / 非隔行 / colorType 0/2/6 —— 本项目截图的全部情况。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

/* ─────────────── 解码 / 编码 ─────────────── */

function decodePng(buf) {
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG unsupported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 0;
  if (!ch || bitDepth !== 8) {
    throw new Error(`unsupported: colorType=${colorType} bitDepth=${bitDepth}`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = src[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return { w, h, ch, colorType, data: out, row: (y) => out.subarray(y * stride, (y + 1) * stride) };
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** 输出一定是 colorType 2（RGB，无 alpha）—— ASC 拒收带 alpha 通道的截图 */
function encodePng(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ─────────────── 子命令 ─────────────── */

const [cmd, ...rest] = process.argv.slice(2);

function cmdScan(files) {
  if (!files.length) {
    console.error("用法: scan <file.png> [...]");
    process.exit(2);
  }
  let bad = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    const img = decodePng(buf);
    const ok = img.colorType === 2 && buf.length <= 10 * 1024 * 1024;
    if (!ok) bad += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${f.split(/[\\/]/).pop().padEnd(22)} ` +
        `${img.w}x${img.h}  colorType=${img.colorType}  ${(buf.length / 1024).toFixed(0)}KB`
    );
  }
  if (bad) console.log(`\n⚠️ ${bad} 张不合格（要求 colorType=2 无 alpha、≤10MB）`);
  process.exit(bad ? 1 : 0);
}

function cmdCrop([inFile, outFile, x0s, y0s, ws, hs, ss = "1"]) {
  if (!inFile || !outFile) {
    console.error("用法: crop <in.png> <out.png> <x> <y> <w> <h> [scale=1]");
    process.exit(2);
  }
  const x0 = +x0s, y0 = +y0s, cw = +ws, chh = +hs, scale = +ss;
  const img = decodePng(readFileSync(inFile));
  const ow = cw * scale;
  const oh = chh * scale;
  const out = Buffer.alloc(ow * oh * 3);
  for (let y = 0; y < oh; y++) {
    const sy = Math.min(img.h - 1, y0 + Math.floor(y / scale));
    for (let x = 0; x < ow; x++) {
      const sx = Math.min(img.w - 1, x0 + Math.floor(x / scale));
      const si = sy * img.w * img.ch + sx * img.ch;
      const di = (y * ow + x) * 3;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
    }
  }
  writeFileSync(outFile, encodePng(ow, oh, out));
  console.log(`${inFile} 裁 (${x0},${y0}) ${cw}x${chh} ×${scale} → ${outFile} (${ow}x${oh})`);
}

function cmdBars([file, hex = "403f44", tols = "12"]) {
  if (!file) {
    console.error("用法: bars <in.png> [色值hex=403f44] [容差=12]");
    process.exit(2);
  }
  const t = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const tol = +tols;
  const img = decodePng(readFileSync(file));
  console.log(`${file.split(/[\\/]/).pop()}  ${img.w}x${img.h}`);
  for (const dy of [150, 400, img.h - 30]) {
    const y = img.h - dy;
    if (y < 0) continue;
    const row = img.row(y);
    let first = -1, last = -1;
    for (let x = 0; x < img.w; x++) {
      const i = x * img.ch;
      if (
        Math.abs(row[i] - t[0]) <= tol &&
        Math.abs(row[i + 1] - t[1]) <= tol &&
        Math.abs(row[i + 2] - t[2]) <= tol
      ) {
        if (first < 0) first = x;
        last = x;
      }
    }
    console.log(
      `  y=${String(y).padStart(4)} (底往上 ${String(dy).padStart(3)})  ` +
        `匹配色 x=${first}..${last}  宽=${first < 0 ? 0 : last - first + 1}/${img.w}`
    );
  }
}

switch (cmd) {
  case "scan": cmdScan(rest); break;
  case "crop": cmdCrop(rest); break;
  case "bars": cmdBars(rest); break;
  default:
    console.error("子命令: scan | crop | bars  （详见文件头注释）");
    process.exit(2);
}
