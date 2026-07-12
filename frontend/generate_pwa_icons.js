import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
  console.log("🚀 Starting PWA icon generator script...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const publicDir = path.join(__dirname, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Definition of icons to generate
  const icons = [
    { name: "icon-192x192.png", size: 192, maskable: false },
    { name: "icon-512x512.png", size: 512, maskable: false },
    { name: "icon-maskable-192x192.png", size: 192, maskable: true },
    { name: "icon-maskable-512x512.png", size: 512, maskable: true },
    { name: "apple-touch-icon.png", size: 180, maskable: false }
  ];

  for (const icon of icons) {
    console.log(`Rendering ${icon.name} (${icon.size}x${icon.size})...`);

    // We execute canvas operations inside the headless page
    const base64Data = await page.evaluate((args) => {
      const { size, maskable } = args;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      if (!ctx) return "";

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, "#4f46e5"); // indigo-600
      grad.addColorStop(0.5, "#6366f1"); // indigo-500
      grad.addColorStop(1, "#3b82f6"); // blue-500
      
      if (maskable) {
        // Maskable icon covers the entire background square
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Standard icons can have rounded corner canvas designs or circles
        ctx.fillStyle = grad;
        // Draw rounded rect
        const radius = size * 0.22;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
      }

      // Draw stylized orbital POS graphics
      const cx = size / 2;
      const cy = size / 2;
      const scale = maskable ? 0.75 : 1.0;

      // Inner glowing circle
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.18 * scale, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();

      // Stylized "O" text
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = size * 0.04 * scale;
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${size * 0.42 * scale}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("O", cx, cy - size * 0.02 * scale);

      // Clean shadow for orbital lines
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Primary orbital ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = Math.max(2, size * 0.02 * scale);
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.32 * scale, size * 0.14 * scale, Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();

      // Secondary orbital ring (crossing)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = Math.max(1.5, size * 0.015 * scale);
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.32 * scale, size * 0.14 * scale, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();

      // Small glowing POS orb/dot on the ring
      const orbAngle = Math.PI / 3;
      const orbX = cx + (size * 0.32 * scale) * Math.cos(orbAngle) * Math.cos(Math.PI / 4) - (size * 0.14 * scale) * Math.sin(orbAngle) * Math.sin(Math.PI / 4);
      const orbY = cy + (size * 0.32 * scale) * Math.cos(orbAngle) * Math.sin(Math.PI / 4) + (size * 0.14 * scale) * Math.sin(orbAngle) * Math.cos(Math.PI / 4);
      
      ctx.beginPath();
      ctx.arc(orbX, orbY, Math.max(3, size * 0.03 * scale), 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8"; // light blue glow
      ctx.fill();

      return canvas.toDataURL("image/png");
    }, { size: icon.size, maskable: icon.maskable });

    // Save image to disk
    const base64Content = base64Data.replace(/^data:image\/png;base64,/, "");
    const targetPath = path.join(publicDir, icon.name);
    fs.writeFileSync(targetPath, base64Content, "base64");
    console.log(`✅ Successfully generated PWA asset at: ${targetPath}`);
  }

  await browser.close();
  console.log("🎉 All PWA assets rendered successfully.");
}

generateIcons().catch((err) => {
  console.error("❌ PWA icon generation failed:", err);
  process.exit(1);
});
