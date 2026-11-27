import { useEffect } from "react";
import {
  BadgeIndianRupee,
  Boxes,
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
} from "lucide-react";

// Public landing page for logged-out visitors at "/". Every claim below maps to a shipped feature;
// do not add numbers, testimonials or pricing that cannot be verified.
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

const steps = [
  { title: "Add your products", text: "Name, price, GST and stock. Barcodes work if you have them." },
  { title: "Bill the customer", text: "Search or scan, take payment, then print or share on WhatsApp." },
  { title: "Check your day", text: "Sales, dues and low stock are on the dashboard when you need them." },
];

const benefits = [
  { icon: Clock, title: "Shorter queues", text: "Scan or search, take payment and print or share the bill in a few taps." },
  { icon: WifiOff, title: "No lost sales offline", text: "The counter keeps billing when the network drops; bills sync later." },
  { icon: BadgeIndianRupee, title: "Know what you're owed", text: "Customer dues, supplier balances and low stock are on one dashboard." },
];

const phoneSteps = [
  { img: "/landing/step-tap.jpg", title: "Tap", text: "Tap what the customer is buying.", alt: "Apka Bill on a phone with two products tapped into the cart, total ₹384" },
  { img: "/landing/step-pay.jpg", title: "Pay", text: "Cash, UPI or card, then tap Pay.", alt: "Apka Bill on a phone with three items, a total of ₹549 and a Pay button" },
  { img: "/landing/step-done.jpg", title: "Done", text: "Print the bill or send it on WhatsApp.", alt: "Apka Bill on a phone showing the finished receipt with Print and Share buttons" },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

const businesses = ["Kirana & grocery", "General stores", "Mobile & electronics", "Clothing & fashion", "Restaurants & cafes"];

const faqs = [
  { q: "Do I need internet all the time?", a: "No. Billing keeps working offline and the bills sync when the connection returns." },
  { q: "Does it work on a phone?", a: "Yes. The screens are built for small Android phones as well as tablets and computers." },
  { q: "Can I print bills?", a: "Yes, on 58mm thermal printers. You choose whether the logo, UPI QR and barcode appear." },
  { q: "Is my shop's data kept separate?", a: "Yes. Every shop's data is isolated, and each user only sees the stores they are allowed to." },
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
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  #landing-root [data-reveal], #landing-root.reveal-on [data-reveal]:not(.is-in) { opacity: 1; transform: none; transition: none; }
  #landing-root .float, #landing-root details > p { animation: none; }
}`;

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[2.2rem] bg-neutral-900 p-2 shadow-2xl ring-1 ring-black/10 ${className}`}>
      <img src={src} alt={alt} width={430} height={932} loading="lazy" className="block aspect-[430/932] w-full rounded-[1.7rem] object-cover object-top" />
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
    return () => io.disconnect();
  }, []);

  return (
    <div id="landing-root" className="min-h-screen overflow-x-clip bg-background text-foreground antialiased">
      <style>{css}</style>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
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
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24">
          <div data-reveal>
            <p className="text-sm font-semibold text-primary">Billing app for Indian shops</p>
            <h1 className="mt-3 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Billing so simple, <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">anyone can do it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Tap the items, take the payment, hand over the bill. On a phone or a computer, even without internet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#get-started" className={`inline-flex h-13 items-center justify-center rounded-2xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 ${press}`}>
                Get started
              </a>
              <a href="#steps" className={`inline-flex h-13 items-center justify-center rounded-2xl border border-border px-7 py-3.5 text-base font-semibold hover:bg-muted ${press}`}>
                See how it works
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-64 sm:w-72 lg:w-80" data-reveal style={{ transitionDelay: "150ms" }}>
            <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-blue-500/25 via-emerald-400/20 to-transparent blur-3xl" aria-hidden />
            <Phone src="/landing/billing-phone.jpg" alt="Apka Bill on a phone: three items in the cart, total ₹549, and a Pay button" className="float" />
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

        <section id="steps" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-16 sm:py-24" aria-labelledby="steps-title">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center" data-reveal>
              <h2 id="steps-title" className="text-4xl font-bold tracking-tight sm:text-5xl">Three taps to a bill</h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">Real screens from the app, with a demo shop.</p>
            </div>
            {/* Phones: swipe sideways on small screens, three across from sm up. */}
            <ol className="-mx-4 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[14%] pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0 lg:gap-14" data-reveal>
              {phoneSteps.map((p, i) => (
                <li key={p.title} className="w-full shrink-0 snap-center text-center sm:w-auto">
                  <Phone src={p.img} alt={p.alt} className="mx-auto max-w-64" />
                  <h3 className="mt-6 text-2xl font-bold">
                    <span className="text-primary">{i + 1}.</span> {p.title}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">{p.text}</p>
                </li>
              ))}
            </ol>
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
          <div className="mx-auto max-w-6xl px-4">
            <div data-reveal>
              <h2 id="computer-title" className="text-3xl font-bold tracking-tight sm:text-4xl">On a computer too</h2>
              <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Products on the left, the bill on the right. Scan, search or click.</p>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" data-reveal>
              <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted/60 px-4" aria-hidden>
                <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-green-400" />
              </div>
              <img src="/landing/billing-desktop.jpg" alt="Apka Bill billing on a computer: product tiles and a cart with five items and a grand total of ₹1,138 including GST" width={1800} height={1115} loading="lazy" className="block w-full" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" data-reveal>How it works</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} data-reveal style={{ transitionDelay: `${i * 100}ms` }}>
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-base text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4" data-reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Made for shops like yours</h2>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {businesses.map((b) => (
                <li key={b} className="rounded-full border border-border bg-card px-4 py-2 text-base font-medium">{b}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="mobile-title">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[1fr_auto]">
            <div data-reveal>
              <Smartphone className="size-8 text-primary" aria-hidden />
              <h2 id="mobile-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">An Android app for the counter</h2>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Bill from an Android phone or tablet with the same account. The app keeps working offline, prints to
                58mm thermal printers and shares bills on WhatsApp. Ask the Apka Bill team for the app.
              </p>
            </div>
            <div data-reveal style={{ transitionDelay: "120ms" }}>
              <Phone src="/landing/step-done.jpg" alt="Apka Bill on an Android phone showing a finished receipt with Print and Share buttons" className="mx-auto w-56" />
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
              Shop accounts are set up by the Apka Bill team, with your stores and staff logins. Once you have your
              login, everything above works from day one.
            </p>
            <a href="/login" className={`mt-8 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 ${press}`}>
              Log in to your shop
            </a>
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
