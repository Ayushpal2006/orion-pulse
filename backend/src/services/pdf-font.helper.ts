import path from "path";
import fs from "fs";

export function configurePdfFonts(doc: any) {
  const robotoRegular = path.join(__dirname, "../assets/fonts/Roboto-Regular.ttf");
  const robotoBold = path.join(__dirname, "../assets/fonts/Roboto-Bold.ttf");

  const outfitRegular = path.join(__dirname, "../assets/fonts/Outfit-Regular.ttf");
  const outfitBold = path.join(__dirname, "../assets/fonts/Outfit-Bold.ttf");

  if (fs.existsSync(robotoRegular) && fs.existsSync(robotoBold)) {
    doc.registerFont("Outfit", robotoRegular);
    doc.registerFont("Outfit-Bold", robotoBold);
    doc.registerFont("Roboto", robotoRegular);
    doc.registerFont("Roboto-Bold", robotoBold);
    doc.font("Outfit");
  } else if (fs.existsSync(outfitRegular) && fs.existsSync(outfitBold)) {
    doc.registerFont("Outfit", outfitRegular);
    doc.registerFont("Outfit-Bold", outfitBold);
    doc.font("Outfit");
  } else {
    doc.registerFont("Outfit", "Helvetica");
    doc.registerFont("Outfit-Bold", "Helvetica-Bold");
    doc.font("Outfit");
  }
}

export function formatInrPdf(val: number): string {
  const num = Number(val) || 0;
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹ ${formatted}`;
}
