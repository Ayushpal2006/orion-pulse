"""Regenerates web and Android icons/splash from docs/brand/a-receipt-mark.svg.
Usage: mkdir -p /tmp/bg && cp docs/brand/a-receipt-mark.svg /tmp/bg/mark.svg && python3 scripts/generate-brand-assets.py /tmp/bg  (needs Google Chrome)."""
import subprocess, sys, os, struct
W = sys.argv[1]; FE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend"); RES = f"{FE}/android/app/src/main/res"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MARIGOLD, INK, WHITE = "#FCA311", "#14213D", "#FFFFFF"

def render(out, w, h, bg, mark_frac, radius="0", circle=False):
    m = round(min(w, h) * mark_frac)
    shape = "border-radius:50%;" if circle else f"border-radius:{radius};"
    html = (f'<html><body style="margin:0;background:transparent"><div style="width:{w}px;height:{h}px;background:{bg};{shape}'
            f'display:grid;place-items:center;overflow:hidden"><img src="mark.svg" style="width:{m}px;height:{m}px"></div></body></html>')
    p = f"{W}/r.html"; open(p, "w").write(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                    f"--window-size={w},{h}", f"--screenshot={out}", f"file://{p}"], check=True, capture_output=True)

# Web
render(f"{FE}/public/logo.png", 512, 512, "transparent", 0.92)
for s in (192, 512):
    render(f"{FE}/public/icon-{s}x{s}.png", s, s, MARIGOLD, 0.66, "22%")
    render(f"{FE}/public/icon-maskable-{s}x{s}.png", s, s, MARIGOLD, 0.5)   # full bleed, mark inside the 80% safe zone
render(f"{FE}/public/apple-touch-icon.png", 180, 180, MARIGOLD, 0.66)     # iOS rounds corners itself
for s in (16, 32, 48):
    render(f"{W}/fav{s}.png", s, s, "transparent", 1.0)
# ICO with embedded PNG images (supported by all current browsers)
imgs = [open(f"{W}/fav{s}.png", "rb").read() for s in (16, 32, 48)]
hdr = struct.pack("<HHH", 0, 1, len(imgs)); off = 6 + 16 * len(imgs); ents = b""
for s, d in zip((16, 32, 48), imgs):
    ents += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(d), off); off += len(d)
open(f"{FE}/public/favicon.ico", "wb").write(hdr + ents + b"".join(imgs))

# Android launcher icons
for d, s in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    render(f"{RES}/mipmap-{d}/ic_launcher.png", s, s, MARIGOLD, 0.66, "22%")
    render(f"{RES}/mipmap-{d}/ic_launcher_round.png", s, s, MARIGOLD, 0.62, circle=True)
for d, s in {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}.items():
    render(f"{RES}/mipmap-{d}/ic_launcher_foreground.png", s, s, "transparent", 0.44)  # inside the 66/108 safe zone
# Splash screens: keep each file's existing size
for root, _, files in os.walk(RES):
    if "splash.png" in files:
        f = f"{root}/splash.png"
        w, h = [int(x) for x in subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", f], capture_output=True, text=True).stdout.split()[-3::2]]
        render(f, w, h, WHITE, 0.28)
print("done")
