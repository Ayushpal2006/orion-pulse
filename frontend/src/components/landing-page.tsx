import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeIndianRupee,
  Boxes,
  Check,
  Clock,
  Smartphone,
  ChefHat,
  FileBarChart,
  IndianRupee,
  MessageCircle,
  Printer,
  QrCode,
  ScanBarcode,
  Store,
  Truck,
  Users,
  WifiOff,
  X,
} from "lucide-react";

// Public landing page for logged-out visitors at "/". Every claim below maps to a shipped feature;
// do not add numbers, testimonials or pricing that cannot be verified.
// The phone and computer screens are simplified illustrations drawn here, not screenshots of the app.
const features = [
  { icon: ScanBarcode, title: "Fast billing", text: "Search by name, SKU or barcode, change quantity, add discount and GST, done." },
  { icon: IndianRupee, title: "Cash, UPI, card or credit", text: "Pick the payment in one tap. Partial payments keep the balance as due." },
  { icon: QrCode, title: "UPI QR on the bill", text: "Your UPI ID prints as a scannable QR so customers pay the exact amount." },
  { icon: MessageCircle, title: "Share on WhatsApp", text: "Send the bill to the customer on WhatsApp with a clear summary of the amount." },
  { icon: Printer, title: "Thermal printing", text: "Print 58mm receipts with your logo, UPI QR and barcode, each switchable." },
  { icon: WifiOff, title: "Works without internet", text: "Keep billing when the network drops. Bills sync once you are back online." },
  { icon: Boxes, title: "Stock that stays right", text: "Stock updates with every sale and purchase. Low and out-of-stock items stand out." },
  { icon: Users, title: "Customers and dues", text: "See each customer's purchases and what they still owe." },
  { icon: Truck, title: "Suppliers and purchases", text: "Record purchases, supplier balances and payments in one place." },
  { icon: FileBarChart, title: "Reports and profit", text: "Daily sales, profit and expenses, with PDF and Excel export." },
  { icon: Store, title: "More than one shop", text: "Run several stores under one account and switch between them." },
  { icon: ChefHat, title: "Kitchen tickets", text: "Restaurants and cafes can send kitchen items to a separate KOT printer." },
];

const benefits = [
  { icon: Clock, title: "Shorter queues", text: "Tap the items, take payment and print or share the bill in a few taps." },
  { icon: WifiOff, title: "No lost sales offline", text: "The counter keeps billing when the network drops; bills sync later." },
  { icon: BadgeIndianRupee, title: "Know what you're owed", text: "Customer dues, supplier balances and low stock are in one place." },
];

const compare = [
  ["Customers wait while you write and add up", "The bill is ready in a few taps"],
  ["Dues sit in a notebook", "Every customer's due is tracked"],
  ["Stock is a guess", "Stock updates with every sale"],
  ["You hunt for the QR when someone wants UPI", "Your UPI QR is on every bill"],
  ["A lost paper bill is gone", "Every bill is saved and can go on WhatsApp"],
];

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

const businesses = ["Kirana & grocery", "General stores", "Mobile & electronics", "Clothing & fashion", "Restaurants & cafes"];

export const faqs = [
  { q: "Who is Apka Bill for?", a: "Shop owners and their staff: kirana and general stores, mobile and clothing shops, restaurants and cafes." },
  { q: "Do I need internet all the time?", a: "No. Billing keeps working offline and the bills sync when the connection returns." },
  { q: "Does it work on a phone?", a: "Yes. The screens are built for small Android phones as well as tablets and computers." },
  { q: "Can I print bills?", a: "Yes, on 58mm thermal printers. You choose whether the logo, UPI QR and barcode appear." },
  { q: "Is my shop's data kept separate?", a: "Yes. Every shop's data is isolated, and each user only sees the stores they are allowed to." },
];

// Sales contact, supplied by the owner. Opens WhatsApp with a ready message.
const WHATSAPP = `https://wa.me/917982272206?text=${encodeURIComponent("Hi, I want to use Apka Bill for my shop.")}`;

// Demo shop for the illustrated screens. Generic goods, prices include GST.
const items = [
  { e: "🧼", name: "Soap", price: 40 },
  { e: "🍵", name: "Tea 250g", price: 140 },
  { e: "🍪", name: "Biscuits", price: 30 },
  { e: "🥛", name: "Milk 1L", price: 68 },
  { e: "🍚", name: "Rice 5kg", price: 420 },
  { e: "🧂", name: "Salt 1kg", price: 28 },
  { e: "🍜", name: "Noodles", price: 14 },
  { e: "🌻", name: "Oil 1L", price: 165 },
];
const sum = (picked: number[]) => picked.reduce((s, i) => s + items[i].price, 0);
// Plain text on purpose: a scanned demo code must never open a payment to a real UPI ID.
const DEMO_QR = "Apka Bill demo. Not a real payment.";

type Screen = "shop" | "pay" | "done";
const phoneSteps: { title: string; text: string; picked: number[]; screen: Screen }[] = [
  { title: "Tap", text: "Tap what the customer is buying.", picked: [0, 1], screen: "shop" },
  { title: "Pay", text: "Cash, UPI or card. The QR shows the exact amount.", picked: [0, 1, 3], screen: "pay" },
  { title: "Done", text: "Print the bill or send it on WhatsApp.", picked: [0, 1, 3], screen: "done" },
];

// Shared feel for every button and link: lift on hover, press in on click.
const press = "transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95";
const css = `
html { scroll-behavior: smooth; }
#landing-root [data-reveal] { transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); }
#landing-root.reveal-on [data-reveal]:not(.is-in) { opacity: 0; transform: translateY(28px) scale(.98); }
#landing-root details > p { animation: landing-open .35s cubic-bezier(.16,1,.3,1); }
@keyframes landing-open { from { opacity: 0; transform: translateY(-6px); } }
@keyframes landing-float { 50% { transform: translateY(-10px); } }
#landing-root .float { animation: landing-float 6s ease-in-out infinite; }
#landing-root .progress { transform-origin: 0 50%; transform: scaleX(0); }
@supports (animation-timeline: view()) {
  @keyframes landing-progress { to { transform: scaleX(1); } }
  #landing-root .progress { animation: landing-progress linear both; animation-timeline: scroll(root); }
  @keyframes landing-zoom { from { transform: scale(.82); border-radius: 2.5rem; opacity: .6; } }
  #landing-root .zoom-in { animation: landing-zoom linear both; animation-timeline: view(); animation-range: entry 0% cover 45%; }
  @keyframes landing-tilt { from { transform: perspective(1400px) rotateX(22deg) scale(.9); opacity: .5; } }
  #landing-root .tilt-in { transform-origin: 50% 100%; animation: landing-tilt linear both; animation-timeline: view(); animation-range: entry 0% cover 40%; }
}
@media (prefers-reduced-motion: reduce) {
  #landing-root .progress, #landing-root .zoom-in, #landing-root .tilt-in { animation: none; }
  html { scroll-behavior: auto; }
  #landing-root [data-reveal], #landing-root.reveal-on [data-reveal]:not(.is-in) { opacity: 1; transform: none; transition: none; }
  #landing-root .float, #landing-root details > p { animation: none; }
}`;

function Tile({ i, on, onClick, tabIndex }: { i: number; on: boolean; onClick?: () => void; tabIndex?: number }) {
  const it = items[i];
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      aria-pressed={on}
      onClick={onClick}
      className={`relative flex flex-col justify-center rounded-[1em] border-2 p-[.7em] text-left transition duration-150 active:scale-95 ${on ? "border-green-500 bg-green-50" : "border-transparent bg-white shadow-sm"}`}
    >
      <span className="block text-[2.6em] leading-none">{it.e}</span>
      <span className="mt-[.35em] block text-[.95em] font-semibold">{it.name}</span>
      <span className="block text-[.95em] font-bold text-green-700">₹{it.price}</span>
      {on && <span className="absolute top-[.5em] right-[.5em] grid size-[1.6em] place-items-center rounded-full bg-green-500 text-[.8em] font-bold text-white">✓</span>}
    </button>
  );
}

// One phone, three screens. `live` lets visitors tap through a bill; otherwise it is a still picture.
function Demo({ picked: p0 = [], screen: s0 = "shop", live = false, label, className = "" }: { picked?: number[]; screen?: Screen; live?: boolean; label?: string; className?: string }) {
  const [picked, setPicked] = useState(p0);
  const [screen, setScreen] = useState<Screen>(s0);
  const total = sum(picked);
  const tab = live ? 0 : -1;
  return (
    <div className={`rounded-[2.2rem] bg-neutral-900 p-2 shadow-2xl ring-1 ring-black/10 ${className}`} role={live ? "group" : "img"} aria-label={label}>
      <div data-screen className="aspect-[390/844] overflow-hidden rounded-[1.7rem] bg-[#f6f5f1] text-neutral-900" style={{ containerType: "inline-size" }}>
        {/* Everything inside is sized in em, so the screen scales with the phone. */}
        <div className={`flex h-full flex-col text-left ${live ? "" : "pointer-events-none"}`} style={{ fontSize: "4.1cqw" }} aria-hidden={!live}>
          {screen === "shop" && (
            <>
              <div className="flex items-center gap-[.6em] px-[1em] pt-[1.2em]">
                <img src="/logo.png" alt="" className="size-[2em] rounded-[.5em]" />
                <span className="text-[1.05em] font-bold">Sharma General Store</span>
              </div>
              <p className="px-[1em] pt-[.5em] pb-[.7em] text-[.85em] text-neutral-500">Tap what the customer is buying</p>
              <div className="grid flex-1 grid-cols-2 grid-rows-4 gap-[.6em] px-[1em]">
                {items.map((it, i) => (
                  <Tile key={it.name} i={i} on={picked.includes(i)} tabIndex={tab} onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} />
                ))}
              </div>
              <div className="m-[.8em] flex items-center justify-between rounded-[1.1em] bg-neutral-900 p-[.7em] pl-[1.1em] text-white">
                <div>
                  <div className="text-[.75em] opacity-70">{picked.length ? `${picked.length} item${picked.length > 1 ? "s" : ""}` : "Tap an item"}</div>
                  <div className="text-[1.35em] leading-tight font-bold">₹{total}</div>
                </div>
                <button type="button" data-pay tabIndex={tab} disabled={!picked.length} onClick={() => setScreen("pay")} className="rounded-[.8em] bg-green-500 px-[1.6em] py-[.7em] text-[1.05em] font-bold transition active:scale-95 disabled:opacity-40">
                  Pay
                </button>
              </div>
            </>
          )}
          {screen === "pay" && (
            <div className="flex h-full flex-col items-center px-[1.2em] pt-[2.2em] text-center">
              <div className="text-[.9em] text-neutral-500">Collect</div>
              <div className="text-[3.2em] leading-tight font-extrabold">₹{total}</div>
              <div className="mt-[1em] grid w-full grid-cols-3 gap-[.5em]">
                {["Cash", "UPI", "Card"].map((m) => (
                  <span key={m} className={`rounded-[.8em] py-[.7em] text-[.95em] font-bold ${m === "UPI" ? "bg-neutral-900 text-white" : "bg-white shadow-sm"}`}>{m}</span>
                ))}
              </div>
              <div className="mt-[1.4em] rounded-[1.2em] bg-white p-[1em] shadow-sm">
                <QRCodeSVG value={DEMO_QR} style={{ width: "13em", height: "13em" }} />
              </div>
              <p className="mt-[.9em] text-[.9em] text-neutral-500">Customer scans with any UPI app</p>
              <button type="button" data-paid tabIndex={tab} onClick={() => setScreen("done")} className="mt-auto mb-[1em] w-full rounded-[1em] bg-green-500 py-[.9em] text-[1.1em] font-bold text-white transition active:scale-95">
                Payment received
              </button>
            </div>
          )}
          {screen === "done" && (
            <div className="flex h-full flex-col px-[1.2em] pt-[1.8em]">
              <div className="text-center text-[1.25em] font-bold text-green-700">✓ Bill ready</div>
              <div className="mt-[1em] rounded-[.8em] bg-white p-[1.1em] font-mono shadow-sm">
                <div className="text-center font-bold">SHARMA GENERAL STORE</div>
                <div className="my-[.7em] border-t border-dashed border-neutral-300" />
                {picked.map((i) => (
                  <div key={i} className="flex justify-between text-[.9em] leading-[1.8]">
                    <span>1 x {items[i].name}</span>
                    <span>₹{items[i].price}</span>
                  </div>
                ))}
                <div className="my-[.7em] border-t border-dashed border-neutral-300" />
                <div className="flex justify-between text-[1.15em] font-bold">
                  <span>TOTAL</span>
                  <span>₹{total}</span>
                </div>
                <div className="text-[.7em] text-neutral-500">GST included</div>
                <div className="mt-[.9em] flex flex-col items-center">
                  <QRCodeSVG value={DEMO_QR} style={{ width: "7.5em", height: "7.5em" }} />
                  <span className="mt-[.4em] text-[.7em] text-neutral-500">Scan to pay by UPI</span>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-[.6em]">
                <span className="rounded-[.9em] bg-white py-[.8em] text-center font-bold shadow-sm">🖨️ Print</span>
                <span className="rounded-[.9em] bg-green-500 py-[.8em] text-center font-bold text-white">WhatsApp</span>
              </div>
              <button type="button" data-new tabIndex={tab} onClick={() => { setPicked([]); setScreen("shop"); }} className="my-[.8em] rounded-[.9em] bg-neutral-900 py-[.8em] font-bold text-white transition active:scale-95">
                New bill
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The same shop on a computer: products on the left, the bill on the right.
function Desk() {
  const picked = [0, 1, 3];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" role="img" aria-label="Apka Bill on a computer: product tiles on the left and a bill of ₹248 with a UPI QR and a Pay button on the right">
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted/60 px-4">
        <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-green-400" />
      </div>
      <div data-desk className="bg-[#f6f5f1] text-neutral-900" style={{ containerType: "inline-size" }} aria-hidden>
        <div className="pointer-events-none grid grid-cols-[1fr_32%] gap-[1.2em] p-[1.2em]" style={{ fontSize: "clamp(6.5px, 1.9cqw, 16px)" }}>
          <div className="grid grid-cols-4 gap-[.7em]">
            {items.map((it, i) => <Tile key={it.name} i={i} on={picked.includes(i)} tabIndex={-1} />)}
          </div>
          <div className="flex flex-col rounded-[1em] bg-white p-[1.1em] shadow-sm">
            <div className="text-[1.2em] font-bold">Bill</div>
            {picked.map((i) => (
              <div key={i} className="mt-[.6em] flex justify-between">
                <span>{items[i].e} {items[i].name}</span>
                <span className="font-semibold">₹{items[i].price}</span>
              </div>
            ))}
            <div className="mt-[.8em] flex justify-between border-t border-neutral-200 pt-[.7em] text-[1.4em] font-extrabold">
              <span>Total</span>
              <span>₹{sum(picked)}</span>
            </div>
            <div className="mt-[.9em] flex items-center gap-[.8em]">
              <QRCodeSVG value={DEMO_QR} style={{ width: "5.5em", height: "5.5em" }} />
              <span className="text-[.85em] text-neutral-500">Scan to pay by UPI</span>
            </div>
            <span className="mt-[1em] rounded-[.8em] bg-green-500 py-[.8em] text-center text-[1.15em] font-bold text-white">Pay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  // Sections fade up as they scroll into view. Content stays visible if this never runs.
  useEffect(() => {
    const root = document.getElementById("landing-root");
    if (!root || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    root.classList.add("reveal-on");
    const video = root.querySelector("video");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const vio = new IntersectionObserver(([e]) => {
      if (!video || calm) return;
      if (e.isIntersecting) { video.muted = true; video.play().catch(() => {}); } else video.pause();
    }, { threshold: 0.5 });
    if (video) vio.observe(video);
    return () => { io.disconnect(); vio.disconnect(); };
  }, []);

  return (
    <div id="landing-root" className="min-h-screen overflow-x-clip bg-background text-foreground antialiased">
      <style>{css}</style>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="progress absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-blue-600 to-green-500" aria-hidden />
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Main">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold">
            <img src="/logo.png" alt="" className="size-9 rounded-xl border border-border/50" />
            Apka Bill
          </a>
          <div className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className={`hidden h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex ${press}`}>
                {l.label}
              </a>
            ))}
            <a href="/login" className={`inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-muted ${press}`}>
              Log in
            </a>
            <a href="#get-started" className={`inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm sm:px-5 ${press}`}>
              Get started
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:pb-24">
          <div data-reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Store className="size-4" aria-hidden /> Billing software for shop owners
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Billing so simple, <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">anyone can do it.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Run your shop's counter from a phone or a computer. Tap the items, take the payment, hand over the bill,
              even without internet.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#get-started" className={`inline-flex items-center justify-center rounded-2xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 ${press}`}>
                Get started
              </a>
              <a href="#how-it-works" className={`inline-flex items-center justify-center rounded-2xl border border-border px-7 py-3.5 text-base font-semibold hover:bg-muted ${press}`}>
                See how it works
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-2" aria-label="Made for">
              {businesses.map((b) => (
                <li key={b} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium">{b}</li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-72 lg:max-w-80" data-reveal style={{ transitionDelay: "150ms" }}>
            <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-blue-500/25 via-emerald-400/20 to-transparent blur-3xl" aria-hidden />
            <p className="mb-3 text-center text-sm font-semibold text-primary">Try it. Tap an item, then Pay.</p>
            <div id="hero-demo">
              <Demo live label="Try Apka Bill: tap items, then Pay" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-20" aria-labelledby="benefits-title">
          <h2 id="benefits-title" className="sr-only">Why shops use Apka Bill</h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {benefits.map((b, i) => (
              <li key={b.title} className="flex gap-4" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <b.icon className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{b.title}</h3>
                  <p className="mt-1 text-base text-muted-foreground">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 sm:py-24" aria-labelledby="steps-title">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center" data-reveal>
              <h2 id="steps-title" className="text-3xl font-bold tracking-tight sm:text-5xl">Three taps to a bill</h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">No training needed. If you can use WhatsApp, you can use Apka Bill.</p>
            </div>
            {/* Phones: swipe sideways on small screens, three across from sm up. */}
            <ol className="-mx-4 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[14%] pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0 lg:gap-14" data-reveal>
              {phoneSteps.map((p, i) => (
                <li key={p.title} className="w-full shrink-0 snap-center text-center sm:w-auto">
                  <Demo picked={p.picked} screen={p.screen} label={`Step ${i + 1}, ${p.title}: ${p.text}`} className="mx-auto max-w-64" />
                  <h3 className="mt-6 text-2xl font-bold">
                    <span className="text-primary">{i + 1}.</span> {p.title}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center text-sm text-muted-foreground">Simplified preview with a demo shop.</p>
          </div>
        </section>

        <section className="bg-neutral-950 py-20 text-white sm:py-28" aria-labelledby="video-title">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 id="video-title" className="text-3xl font-bold tracking-tight sm:text-5xl" data-reveal>
              See it in <span className="bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">30 seconds</span>
            </h2>
            {/* Muted and looping; the effect above plays it only while it is on screen. Controls let visitors turn sound on. */}
            <video className="zoom-in mt-10 aspect-video w-full rounded-2xl bg-black shadow-2xl ring-1 ring-white/10" controls muted loop playsInline preload="metadata" poster="/landing/video-poster.jpg">
              <source src="/landing/apka-bill.mp4" type="video/mp4" />
              <track kind="captions" src="/landing/apka-bill.vtt" srcLang="en" label="English" />
            </video>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16 sm:py-24" aria-labelledby="compare-title">
          <div className="mx-auto max-w-4xl px-4">
            <h2 id="compare-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl" data-reveal>Still writing bills by hand?</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6" data-reveal>
                <h3 className="text-lg font-semibold text-muted-foreground">By hand</h3>
                <ul className="mt-4 space-y-3">
                  {compare.map(([bad]) => (
                    <li key={bad} className="flex gap-3 text-base text-muted-foreground">
                      <X className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden /> {bad}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border-2 border-primary bg-card p-6 shadow-xl" data-reveal style={{ transitionDelay: "120ms" }}>
                <h3 className="text-lg font-semibold">With Apka Bill</h3>
                <ul className="mt-4 space-y-3">
                  {compare.map(([, good]) => (
                    <li key={good} className="flex gap-3 text-base font-medium">
                      <Check className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden /> {good}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" data-reveal>Everything the counter needs</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <li key={f.title} className="rounded-2xl border border-border bg-card p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg" data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                  <f.icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-base text-muted-foreground">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16 sm:py-24" aria-labelledby="computer-title">
          <div className="mx-auto max-w-5xl px-4">
            <div data-reveal>
              <h2 id="computer-title" className="text-3xl font-bold tracking-tight sm:text-4xl">On a computer too</h2>
              <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Products on the left, the bill on the right. Scan, search or click.</p>
            </div>
            <div className="tilt-in mt-10">
              <Desk />
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="mobile-title">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[1fr_auto]">
            <div data-reveal>
              <Smartphone className="size-8 text-primary" aria-hidden />
              <h2 id="mobile-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">An Android app for the counter</h2>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Bill from an Android phone or tablet with the same account. The app keeps working offline, prints to
                58mm thermal printers and shares bills on WhatsApp.{" "}
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Ask us for the app on WhatsApp.</a>
              </p>
            </div>
            <div data-reveal style={{ transitionDelay: "120ms" }}>
              <Demo picked={[0, 1, 3]} screen="done" label="Apka Bill on an Android phone showing a finished bill with a UPI QR, Print and WhatsApp" className="mx-auto w-56" />
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-border/60 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4" data-reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
            <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold marker:hidden">
                    {f.q}
                    <span className="text-2xl font-normal text-muted-foreground transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-2 text-base text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="get-started" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center" data-reveal>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Ready to bill?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Message us on WhatsApp. We set up your shop, your products and your staff logins, so you can start
              billing.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-600/20 ${press}`}>
                <MessageCircle className="size-5" aria-hidden /> Chat on WhatsApp
              </a>
              <a href="/login" className={`inline-flex items-center justify-center rounded-2xl border border-border px-8 py-3.5 text-base font-semibold hover:bg-muted ${press}`}>
                Log in to your shop
              </a>
            </div>
            <p className="mt-4 text-base text-muted-foreground">WhatsApp: +91 79822 72206</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Apka Bill</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className={`inline-flex h-11 items-center hover:text-foreground ${press}`}>{l.label}</a>
            ))}
            <a href="/login" className={`inline-flex h-11 items-center hover:text-foreground ${press}`}>Log in</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
