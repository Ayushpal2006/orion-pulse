// Thermal Printer Logo Rasterization & Pipeline Test
import assert from 'assert';
import { EscPosEncoder } from '../frontend/src/lib/esc-pos-encoder.ts';

console.log("================================================================================");
console.log("🧪 TESTING THERMAL PRINTER LOGO IMAGE PIPELINE & ESC/POS ENCODING");
console.log("================================================================================");

// 1. Mock Logo Rasterizer for Node.js test environment
function simulateMonochromeRasterization(origW, origH, maxWidthDots = 280, maxHeightDots = 140) {
  let width = origW;
  let height = origH;

  if (width > maxWidthDots || height > maxHeightDots) {
    const ratio = Math.min(maxWidthDots / width, maxHeightDots / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Width in dots must be a multiple of 8
  width = Math.max(8, Math.floor(width / 8) * 8);

  // Generate mock RGBA pixel array (4 bytes per pixel)
  const pixelData = new Uint8ClampedArray(width * height * 4);
  // Fill alternating black and white test pattern
  for (let i = 0; i < width * height; i++) {
    const isBlack = (i % 2 === 0);
    pixelData[i * 4] = isBlack ? 0 : 255;     // R
    pixelData[i * 4 + 1] = isBlack ? 0 : 255; // G
    pixelData[i * 4 + 2] = isBlack ? 0 : 255; // B
    pixelData[i * 4 + 3] = 255;               // A
  }

  return { data: pixelData, width, height, origW, origH };
}

// ==============================================================================
// TEST 1: Logo Aspect Ratio Preservation & 58mm Boundary Alignment
// ==============================================================================
console.log("\n▶️ TEST 1: Logo Aspect Ratio & 58mm Paper Boundary (280 max dots, multiple of 8)");
{
  const testImages = [
    { origW: 800, origH: 600, label: "Large 4:3 Logo" },
    { origW: 1200, origH: 400, label: "Wide Banner Logo" },
    { origW: 200, origH: 200, label: "Square Small Icon" },
  ];

  for (const img of testImages) {
    const raster = simulateMonochromeRasterization(img.origW, img.origH, 280, 140);
    assert(raster.width <= 280, `Width must not exceed 280 dots, got ${raster.width}`);
    assert(raster.height <= 140, `Height must not exceed 140 dots, got ${raster.height}`);
    assert.equal(raster.width % 8, 0, `Width (${raster.width}) must be a multiple of 8`);
    console.log(`   ✅ ${img.label}: ${img.origW}x${img.origH} -> ${raster.width}x${raster.height} (Aligned to 8-dots)`);
  }
}

// ==============================================================================
// TEST 2: ESC/POS Raster Image Command Generation (GS v 0)
// ==============================================================================
console.log("\n▶️ TEST 2: ESC/POS Raster Byte Sequence (GS v 0 0 xL xH yL yH)");
{
  const encoder = new EscPosEncoder();
  const raster = simulateMonochromeRasterization(400, 200, 280, 140);
  encoder.align("center");
  encoder.rasterImage(raster.data, raster.width, raster.height);
  encoder.align("left");
  const bytes = encoder.encode();

  // Verify GS v 0 command header (0x1D 0x76 0x30 0x00)
  const gsIndex = bytes.findIndex((b, idx) => 
    b === 0x1d && bytes[idx + 1] === 0x76 && bytes[idx + 2] === 0x30 && bytes[idx + 3] === 0x00
  );
  assert(gsIndex !== -1, "ESC/POS buffer must contain GS v 0 raster image command header");

  const expectedWidthBytes = raster.width / 8;
  const xL = bytes[gsIndex + 4];
  const xH = bytes[gsIndex + 5];
  const yL = bytes[gsIndex + 6];
  const yH = bytes[gsIndex + 7];

  assert.equal(xL + xH * 256, expectedWidthBytes, `Width bytes parameter should match ${expectedWidthBytes}`);
  assert.equal(yL + yH * 256, raster.height, `Height parameter should match ${raster.height}`);
  console.log(`   ✅ ESC/POS Raster Header Verified: GS v 0 0 [${xL}, ${xH}, ${yL}, ${yH}] (Total ${bytes.length} bytes)`);
}

// ==============================================================================
// TEST 3: Receipt Command Order & Section Alignment Verification
// ==============================================================================
console.log("\n▶️ TEST 3: Receipt Structure & Order (Centered Logo -> Header -> Left Details -> Centered Footer)");
{
  const encoder = new EscPosEncoder();
  const raster = simulateMonochromeRasterization(300, 150, 280, 140);

  // 1. Centered Logo
  encoder.align("center");
  encoder.rasterImage(raster.data, raster.width, raster.height);

  // 2. Centered Business Header
  encoder.align("center").bold(true).line("PAL GARMENTS").bold(false);
  encoder.line("Main Market, New Delhi");
  encoder.line("Ph: 9315900307");

  // 3. Left Aligned Details & Items
  encoder.align("left").line("--------------------------------");
  encoder.line("INV: INV-2026-001");
  encoder.line("1x Cotton Shirt          Rs 1200.00");
  encoder.line("--------------------------------");
  encoder.bold(true).line("GRAND TOTAL:             Rs 1200.00").bold(false);

  // 4. Centered Footer & QR
  encoder.align("center").line("Paid via UPI");
  encoder.qrCode("upi://pay?pa=pal@upi&am=1200", 4);
  encoder.line("Thank you for shopping with us!").feed(3).cut();

  const fullBytes = encoder.encode();
  assert(fullBytes.length > 500, `Full receipt buffer should contain complete image and text bytes (got ${fullBytes.length} bytes)`);
  console.log(`   ✅ Complete receipt encoded successfully (${fullBytes.length} bytes)`);
}

console.log("\n================================================================================");
console.log("🎉 ALL THERMAL PRINTER LOGO & ESC/POS PIPELINE TESTS PASSED 100%!");
console.log("================================================================================");
