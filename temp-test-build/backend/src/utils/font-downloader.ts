import fs from "fs";
import path from "path";
import https from "https";
import { logger } from "../logger/logger";

export async function downloadFonts(): Promise<void> {
  const fontDir = path.join(__dirname, "../assets/fonts");
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }

  const fonts = [
    {
      name: "Outfit-Regular.ttf",
      url: "https://cdn.jsdelivr.net/gh/Outfitio/Outfit-Fonts@main/fonts/ttf/Outfit-Regular.ttf"
    },
    {
      name: "Outfit-Bold.ttf",
      url: "https://cdn.jsdelivr.net/gh/Outfitio/Outfit-Fonts@main/fonts/ttf/Outfit-Bold.ttf"
    }
  ];

  for (const font of fonts) {
    const dest = path.join(fontDir, font.name);
    if (!fs.existsSync(dest)) {
      logger.info(`⏳ Downloading font: ${font.name}...`);
      try {
        await downloadFile(font.url, dest);
        logger.info(`✅ Downloaded ${font.name} successfully.`);
      } catch (err) {
        logger.error(`❌ Failed to download ${font.name}`, err);
        // Clean up partial downloads
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
      }
    }
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const getUrl = (targetUrl: string) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            getUrl(response.headers.location);
          } else {
            reject(new Error("Redirect header missing location"));
          }
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: status ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      }).on("error", (err) => {
        reject(err);
      });
    };
    getUrl(url);
  });
}
