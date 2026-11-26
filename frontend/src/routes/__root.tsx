import { Capacitor } from "@capacitor/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { PWAInstallBanner } from "@/components/pwa-install-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { LandingPage } from "@/components/landing-page";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "Dashboard · Apka Bill" },
      {
        name: "description",
        content:
          "Offline-first retail command center — sales, orders, profit and inventory at a glance.",
      },
      { name: "author", content: "Apka Bill" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Apka Bill" },
      { name: "theme-color", content: "#14213D" },
      { property: "og:title", content: "Dashboard · Apka Bill" },
      {
        property: "og:description",
        content:
          "Offline-first retail command center — sales, orders, profit and inventory at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dashboard · Apka Bill" },
      {
        name: "twitter:description",
        content:
          "Offline-first retail command center — sales, orders, profit and inventory at a glance.",
      },
      {
        property: "og:image",
        content: "/logo.png",
      },
      {
        name: "twitter:image",
        content: "/logo.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://rsms.me" },
      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Hide the public landing page before first paint for signed-in users and the native app. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(location.pathname==="/"&&(localStorage.getItem("token")||(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())))document.documentElement.classList.add("has-session")}catch(e){}',
          }}
        />
        <style>{".has-session #landing-root{display:none}"}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPrintRoute = pathname.startsWith("/print/");
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login");
  const isWizardRoute = pathname === "/setup-wizard" || pathname.startsWith("/setup-wizard");
  // "/" is the public landing page for visitors on the web. The server render cannot see localStorage, so the
  // first client render matches it; after mount the token is read on every render (e.g. right after login).
  // The native app never shows it: AppShell's guard sends users without a token to /login.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const isLanding = pathname === "/" && !Capacitor.isNativePlatform() && !(hydrated && localStorage.getItem("token"));

  useEffect(() => {
    // The Capacitor app ships its assets inside the APK; a service worker there would only
    // serve stale bundles after an app update.
    if (Capacitor.isNativePlatform()) return;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("Apka Bill: Service Worker successfully loaded:", reg.scope);
            reg.update();
          })
          .catch((err) => {
            console.error("Apka Bill: Service Worker registration failed:", err);
          });
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {isLanding ? (
          <LandingPage />
        ) : isPrintRoute || isLoginRoute || isWizardRoute ? (
          <Outlet />
        ) : (
          <AppShell>
            <Outlet />
          </AppShell>
        )}
        <Toaster position="top-right" />
        {/* Installing only makes sense for signed-in shop users, not landing-page visitors. */}
        {!isLanding && <PWAInstallBanner />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
