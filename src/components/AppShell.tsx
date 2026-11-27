"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  HardDrive,
  Home,
  Mic,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { BrandLockup, LogoMark, Wordmark } from "@/components/Logo";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/products", label: "Products", icon: Package },
  { href: "/history", label: "Bills", icon: ReceiptText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, settings, saveError, storageAvailable } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isSetup = pathname.startsWith("/setup");
  const [dismissedSaveError, setDismissedSaveError] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!settings.setupComplete && !isSetup) {
      router.replace("/setup");
    }
  }, [hydrated, settings.setupComplete, isSetup, router]);

  if (!hydrated) return <BootScreen />;
  if (isSetup) return <>{children}</>;
  if (!settings.setupComplete) return <BootScreen />;

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-surface lg:flex">
        <div className="px-6 pb-5 pt-7">
          <Link href="/" aria-label="VoiceBill home" className="inline-flex">
            <BrandLockup />
          </Link>
        </div>

        <div className="mx-4 mb-6 rounded-xl border border-line bg-surface-soft px-3.5 py-3">
          <p className="vb-caps text-[9.5px]">Current shop</p>
          <p className="mt-1 truncate text-[14px] font-semibold text-ink">{settings.shopName}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
            {settings.phone || "Add a phone number in Settings"}
          </p>
        </div>

        <nav aria-label="Main" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.slice(0, 3).map((item) => {
              const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
              return (
                <li key={item.href}>
                  <NavLink href={item.href} label={item.label} icon={<item.icon className="h-[18px] w-[18px]" aria-hidden="true" />} active={active} />
                </li>
              );
            })}
            <li className="pt-2">
              <Link
                href="/new-bill"
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-[13.5px] font-semibold transition-colors",
                  isActive(pathname, "/new-bill")
                    ? "bg-brand text-white shadow-[0_10px_24px_-16px_rgba(18,80,58,0.9)]"
                    : "bg-brand-soft text-brand-strong hover:bg-brand-tint",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Mic className="h-[18px] w-[18px]" aria-hidden="true" />
                  New Bill
                </span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
                    isActive(pathname, "/new-bill")
                      ? "bg-white/15 text-white"
                      : "bg-white text-brand",
                  )}
                >
                  MIC
                </span>
              </Link>
            </li>
            {NAV.slice(3).map((item) => {
              const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
              return (
                <li key={item.href}>
                  <NavLink href={item.href} label={item.label} icon={<item.icon className="h-[18px] w-[18px]" aria-hidden="true" />} active={active} />
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 border-t border-line px-6 py-5">
          <div className="flex items-start gap-2.5 text-[11.5px] leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <p>
              Your bills stay on this device. Voice is processed by your browser and never uploaded by VoiceBill.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/" className="flex items-center gap-2" aria-label="VoiceBill home">
              <LogoMark className="h-8 w-8 rounded-[9px]" />
              <Wordmark className="text-[17px]" />
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span className="max-w-[38vw] truncate rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                {settings.shopName}
              </span>
              <Link
                href="/settings"
                aria-label="Settings"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-soft"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10"
        >
          {!storageAvailable ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber/25 bg-amber-soft px-3.5 py-3 text-[13px] leading-relaxed text-amber">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                This browser is blocking local storage, so bills cannot be saved. Turn off private browsing or allow
                site data to use VoiceBill.
              </p>
            </div>
          ) : null}
          {saveError && !dismissedSaveError ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[13px] leading-relaxed text-danger"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{saveError}</p>
              <button
                type="button"
                onClick={() => setDismissedSaveError(true)}
                aria-label="Dismiss"
                className="rounded-md p-0.5 hover:bg-white/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
          <MobileTab href="/" label="Home" icon={Home} active={pathname === "/"} />
          <MobileTab href="/products" label="Products" icon={Package} active={isActive(pathname, "/products")} />
          <Link
            href="/new-bill"
            aria-current={isActive(pathname, "/new-bill") ? "page" : undefined}
            className="group flex flex-col items-center gap-1 pb-0.5"
          >
            <span
              className={cn(
                "-mt-5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-brand text-white ring-[5px] ring-canvas shadow-[var(--shadow-mic)] transition-transform duration-150 active:scale-95",
                isActive(pathname, "/new-bill") && "bg-brand-strong",
              )}
            >
              <Mic className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-semibold text-brand-strong">New Bill</span>
          </Link>
          <MobileTab href="/history" label="Bills" icon={ReceiptText} active={isActive(pathname, "/history")} />
          <MobileTab href="/settings" label="Settings" icon={Settings} active={isActive(pathname, "/settings")} />
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
        active ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-surface-soft hover:text-ink",
      )}
    >
      <span className={cn("transition-colors", active ? "text-brand" : "text-ink-faint group-hover:text-ink-soft")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function MobileTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors",
        active ? "text-brand-strong" : "text-ink-faint",
      )}
    >
      <Icon className={cn("h-[21px] w-[21px]", active && "stroke-[2.4]")} aria-hidden="true" />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <div className="animate-pulse">
        <BrandLockup />
      </div>
      <p className="text-[12px] font-medium tracking-wide text-ink-faint">Loading your shop…</p>
    </div>
  );
}
