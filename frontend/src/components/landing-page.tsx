import {
  Boxes,
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

const businesses = ["Kirana & grocery", "General stores", "Mobile & electronics", "Clothing & fashion", "Restaurants & cafes"];

const faqs = [
  { q: "Do I need internet all the time?", a: "No. Billing keeps working offline and the bills sync when the connection returns." },
  { q: "Does it work on a phone?", a: "Yes. The screens are built for small Android phones as well as tablets and computers." },
  { q: "Can I print bills?", a: "Yes, on 58mm thermal printers. You choose whether the logo, UPI QR and barcode appear." },
  { q: "Is my shop's data kept separate?", a: "Yes. Every shop's data is isolated, and each user only sees the stores they are allowed to." },
];

export function LandingPage() {
  return (
    <div id="landing-root" className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Main">
          <a href="/" className="flex items-center gap-2.5 font-bold text-lg">
            <img src="/logo.png" alt="" className="size-9 object-contain dark:rounded-lg dark:bg-white dark:p-0.5" />
            Apka Bill
          </a>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden sm:inline-flex h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#faq" className="hidden sm:inline-flex h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              FAQ
            </a>
            <a href="/login" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90">
              Log in
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <p className="text-sm font-semibold text-primary">Billing app for Indian shops</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Make the bill in seconds. Know your shop every day.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Apka Bill handles billing, GST, stock, customer dues and purchases on your phone or computer, and keeps
            working when the internet does not.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/login" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm hover:opacity-90">
              Log in to your shop
            </a>
            <a href="#features" className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-6 text-base font-semibold hover:bg-muted">
              See what it does
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24" aria-label="Product preview">
          {/* Real screenshots of the billing screen (demo shop data), not mockups. */}
          <div className="flex items-end justify-center gap-6">
            <img
              src="/landing/billing-desktop.jpg"
              alt="Apka Bill billing screen on a computer with five items in the cart and a grand total of ₹1,308 including GST"
              width={1470}
              height={779}
              loading="lazy"
              className="hidden w-full max-w-4xl rounded-2xl border border-border shadow-xl sm:block"
            />
            <img
              src="/landing/billing-phone.jpg"
              alt="Apka Bill billing screen on a phone with three items in the cart and a Pay button"
              width={600}
              height={1200}
              loading="lazy"
              className="w-64 rounded-[2rem] border-4 border-foreground/80 shadow-xl sm:w-44 lg:w-52 sm:-ml-24 sm:mb-[-1.5rem]"
            />
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything the counter needs</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f.title} className="rounded-2xl border border-border bg-card p-5">
                  <f.icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-base text-muted-foreground">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-base text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Made for shops like yours</h2>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {businesses.map((b) => (
                <li key={b} className="rounded-full border border-border bg-card px-4 py-2 text-base font-medium">{b}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
            <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center text-lg font-semibold marker:hidden">{f.q}</summary>
                  <p className="mt-2 text-base text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to bill?</h2>
            <a href="/login" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm hover:opacity-90">
              Log in
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Apka Bill</span>
          <a href="/login" className="inline-flex h-11 items-center hover:text-foreground">Log in</a>
        </div>
      </footer>
    </div>
  );
}
