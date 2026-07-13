/**
 * Creates a proper Windows ICO file with a "G" logo
 * Multi-size: 16x16, 32x32, 48x48, 256x256
 * Uses raw BMP/PNG data embedded in ICO format
 */
const fs = require('fs');
const path = require('path');

// We'll create the ICO by embedding a simple BMP for each size
// ICO format: header + directory entries + image data

function createBMP(size, bgR, bgG, bgB, fgR, fgG, fgB) {
  // Create a simple solid-color BMP with a "G" character outline
  const w = size, h = size;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelDataSize = rowSize * h;
  const fileSize = 54 + pixelDataSize;
  
  const buf = Buffer.alloc(fileSize, 0);
  
  // BMP File Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset to pixel data
  
  // DIB Header (BITMAPINFOHEADER)
  buf.writeUInt32LE(40, 14); // header size
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(-h, 22); // negative = top-down
  buf.writeUInt16LE(1, 26);  // color planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30);  // no compression
  buf.writeUInt32LE(pixelDataSize, 34);
  
  // Fill pixels — dark navy background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const offset = 54 + y * rowSize + x * 3;
      
      // Determine if this pixel is part of the "G" letter
      const cx = x / w; // 0-1
      const cy = y / h; // 0-1
      
      // Centered circle for the G
      const px = (cx - 0.5) * 2; // -1 to 1
      const py = (cy - 0.5) * 2; // -1 to 1
      const r = Math.sqrt(px * px + py * py);
      const angle = Math.atan2(py, px); // -PI to PI
      
      // G shape: arc from ~-30deg to ~150deg (leaving gap on right), with horizontal bar
      const innerR = 0.45;
      const outerR = 0.85;
      const isInRing = r >= innerR && r <= outerR;
      const isArc = isInRing && !(angle > -0.5 && angle < 0.3 && px > 0.1);
      
      // Horizontal bar of G (right middle)
      const isBar = cx > 0.5 && cx < 0.82 && cy > 0.42 && cy < 0.58;
      
      const isG = isArc || isBar;
      
      if (isG) {
        buf[offset]     = fgB; // B
        buf[offset + 1] = fgG; // G
        buf[offset + 2] = fgR; // R
      } else {
        buf[offset]     = bgB;
        buf[offset + 1] = bgG;
        buf[offset + 2] = bgR;
      }
    }
  }
  
  return buf;
}

// Build ICO with 4 sizes
const sizes = [16, 32, 48, 256];
const bmps = sizes.map(s => {
  const bmp = createBMP(s, 10, 15, 30, 245, 158, 11); // navy bg, amber G
  // For ICO we need just the DIB (skip BMP file header, use DIB)
  return bmp.slice(14); // slice off the 14-byte BMP file header, keep DIB + pixels
});

// ICO File Header (6 bytes)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);  // reserved
icoHeader.writeUInt16LE(1, 2);  // type: 1 = ICO
icoHeader.writeUInt16LE(sizes.length, 4); // count

// ICO Directory Entries (16 bytes each)
const dirEntrySize = 16;
const headerSize = 6 + dirEntrySize * sizes.length;

let offset = headerSize;
const dirEntries = Buffer.alloc(dirEntrySize * sizes.length);

const imageDatas = [];
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  const dibData = bmps[i];
  imageDatas.push(dibData);
  
  const entry = dirEntries;
  const base = i * dirEntrySize;
  entry.writeUInt8(s === 256 ? 0 : s, base);     // width (0 = 256)
  entry.writeUInt8(s === 256 ? 0 : s, base + 1); // height (0 = 256)
  entry.writeUInt8(0, base + 2);   // color count (0 = more than 256)
  entry.writeUInt8(0, base + 3);   // reserved
  entry.writeUInt16LE(1, base + 4); // color planes
  entry.writeUInt16LE(24, base + 6); // bits per pixel
  entry.writeUInt32LE(dibData.length, base + 8); // size of image data
  entry.writeUInt32LE(offset, base + 12); // offset to image data
  
  offset += dibData.length;
}

const icoBuffer = Buffer.concat([icoHeader, dirEntries, ...imageDatas]);
const outPath = path.join(__dirname, 'public', 'icon.ico');
fs.writeFileSync(outPath, icoBuffer);
console.log(`✅ Created ${outPath} (${icoBuffer.length} bytes)`);
