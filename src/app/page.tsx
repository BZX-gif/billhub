"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  Mic,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReceiptDialog } from "@/components/receipt/ReceiptDialog";
import { formatMoney, formatMoneyShort, formatQuantity } from "@/lib/units";
import { formatDate, formatTime, greeting, relativeDayLabel } from "@/lib/format";
import type { Bill } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function DashboardPage() {
  const { settings, bills, draft, draftTotals, draftValidation, products, todaySummary } = useApp();
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);
  const symbol = settings.currencySymbol;
  const recentBills = bills.slice(0, 5);
  const sampleCount = products.filter((product) => product.isSample).length;
  const draftCount = draft.items.length;
  const now = new Date();

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <p className="vb-caps text-brand">{formatDate(now)}</p>
        <h1 className="font-display text-[clamp(1.75rem,4.5vw,2.2rem)] font-medium leading-[1.1] tracking-[-0.025em] text-ink">
          {greeting(now)}, {settings.shopName}
        </h1>
        <p className="text-[14px] text-ink-soft">
          {todaySummary.billCount > 0
            ? `You’ve made ${todaySummary.billCount} bill${todaySummary.billCount === 1 ? "" : "s"} today. Ready for the next one?`
            : "Ready for the first bill of the day? Tap the mic and speak."}
        </p>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-brand/15 bg-[linear-gradient(135deg,#f0f7f2_0%,#ffffff_58%,#fbf5e9_100%)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/5"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-amber/5"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <p className="vb-caps flex items-center gap-1.5 text-brand">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Speak. Review. Bill.
            </p>
            <h2 className="mt-2 max-w-lg font-display text-[clamp(1.55rem,4vw,2.15rem)] font-medium leading-[1.06] tracking-[-0.03em] text-ink">
              Your next bill takes about ten seconds.
            </h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
              Tap the mic and say “3 kilo chini aur 2 kilo aata”. Check every line, then print the receipt.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/new-bill">
                <Button size="lg" leadingIcon={<Mic className="h-[18px] w-[18px]" aria-hidden="true" />}>
                  {draftCount > 0 ? "Resume bill" : "Start new bill"}
                </Button>
              </Link>
              <Link href="/products">
                <Button
                  size="lg"
                  variant="secondary"
                  leadingIcon={<Package className="h-[18px] w-[18px]" aria-hidden="true" />}
                >
                  Products
                </Button>
              </Link>
            </div>
            {draftCount > 0 ? (
              <Link
                href="/new-bill"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                Draft in progress · {draftCount} item{draftCount === 1 ? "" : "s"} ·{" "}
                {formatMoney(draftTotals.total, symbol)}
                {draftValidation.canFinalize ? "" : " · needs review"}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <div className="relative hidden h-[170px] w-[170px] shrink-0 items-center justify-center sm:flex">
            <span className="absolute inset-0 rounded-full border border-brand/15" aria-hidden="true" />
            <span className="absolute inset-4 rounded-full border border-brand/10" aria-hidden="true" />
            <span className="absolute inset-8 rounded-full bg-brand-soft/80" aria-hidden="true" />
            <span className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full bg-brand text-white shadow-[var(--shadow-mic)]">
              <Mic className="h-9 w-9" aria-hidden="true" />
            </span>
            <span className="absolute -right-1 top-6 rounded-full border border-line bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-strong shadow-sm">
              10 sec
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Today's numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="vb-card col-span-2 flex items-start justify-between gap-3 p-4 sm:col-span-1 sm:p-5">
          <div className="min-w-0">
            <p className="vb-caps flex items-center gap-1.5">
              <CircleDollarSign className="h-3 w-3" aria-hidden="true" />
              Today’s sales
            </p>
            <p className="mt-1.5 truncate font-display text-[clamp(1.5rem,5vw,1.9rem)] font-semibold leading-none tabular-nums tracking-[-0.02em]">
              {formatMoney(todaySummary.sales, symbol)}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">From bills saved today</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="vb-card flex items-start justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="vb-caps flex items-center gap-1.5">
              <ReceiptText className="h-3 w-3" aria-hidden="true" />
              Bills today
            </p>
            <p className="mt-1.5 font-display text-[clamp(1.5rem,5vw,1.9rem)] font-semibold leading-none tabular-nums">
              {todaySummary.billCount}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">Saved on this device</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-soft">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="vb-card flex items-start justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="vb-caps flex items-center gap-1.5">
              <ShoppingBag className="h-3 w-3" aria-hidden="true" />
              Items sold
            </p>
            <p className="mt-1.5 font-display text-[clamp(1.5rem,5vw,1.9rem)] font-semibold leading-none tabular-nums">
              {formatQuantity(todaySummary.itemCount)}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">Across today’s bills</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="vb-card overflow-hidden" aria-labelledby="recent-bills">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <h2 id="recent-bills" className="font-display text-[19px] leading-none tracking-[-0.01em]">
                Recent bills
              </h2>
              <p className="mt-1 text-[11.5px] text-ink-faint">Tap a bill to view or reprint it</p>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-brand-strong transition-colors hover:bg-brand-soft"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {recentBills.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                compact
                icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
                title="No bills yet"
                description="Your first saved bill will appear here, ready to reprint anytime."
                action={
                  <Link href="/new-bill">
                    <Button size="sm" leadingIcon={<Mic className="h-3.5 w-3.5" aria-hidden="true" />}>
                      Create first bill
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentBills.map((bill) => (
                <li key={bill.id}>
                  <button
                    type="button"
                    onClick={() => setReceiptBill(bill)}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft sm:px-5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <ReceiptText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[13.5px] font-semibold text-ink">{bill.number}</span>
                        <span className="text-[11px] text-ink-faint">
                          {relativeDayLabel(bill.createdAt)}, {formatTime(bill.createdAt)}
                        </span>
                        {bill.customerName ? (
                          <span className="truncate text-[11px] font-medium text-ink-soft">
                            · {bill.customerName}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-faint">
                        {bill.itemCount} item{bill.itemCount === 1 ? "" : "s"} ·{" "}
                        {bill.items
                          .slice(0, 2)
                          .map((item) => item.name)
                          .join(", ")}
                        {bill.items.length > 2 ? "…" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13.5px] font-semibold tabular-nums text-ink">
                        {formatMoneyShort(bill.total, symbol)}
                      </span>
                      <span className="block text-[10px] text-ink-faint">View</span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="vb-card p-4 sm:p-5" aria-labelledby="quick-access">
            <h2 id="quick-access" className="font-display text-[19px] leading-none tracking-[-0.01em]">
              Quick access
            </h2>
            <div className="mt-3 space-y-2">
              <QuickLink
                href="/products"
                icon={<Package className="h-4 w-4" aria-hidden="true" />}
                title="Products & prices"
                subtitle={
                  products.length > 0
                    ? `${products.length} in catalogue${sampleCount > 0 ? ` · ${sampleCount} sample` : ""}`
                    : "Add your first product"
                }
              />
              <QuickLink
                href="/settings"
                icon={<SettingsIcon className="h-4 w-4" aria-hidden="true" />}
                title="Shop settings"
                subtitle="Name, address, phone, receipt size"
              />
              <QuickLink
                href="/history"
                icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />}
                title="Bill history"
                subtitle={`${bills.length} saved bill${bills.length === 1 ? "" : "s"}`}
              />
            </div>
          </section>

          {sampleCount > 0 ? (
            <section className="rounded-2xl border border-amber/20 bg-amber-soft/70 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-amber">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Sample catalogue
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber">
                {sampleCount} sample product{sampleCount === 1 ? "" : "s"} are in your catalogue with example
                prices. Update them to match your shop.
              </p>
              <Link
                href="/products"
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ink underline decoration-amber/40 underline-offset-2",
                )}
              >
                Review products
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-surface-soft p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">Local & private</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
              Products, bills and settings are stored in this browser only. Take a backup from Settings before
              changing devices or clearing browser data.
            </p>
            <Link
              href="/settings"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-strong"
            >
              Manage data
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>

      <ReceiptDialog open={Boolean(receiptBill)} bill={receiptBill} onClose={() => setReceiptBill(null)} />
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-brand/25 hover:bg-brand-tint"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-soft transition-colors group-hover:bg-white group-hover:text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[11px] text-ink-faint">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
    </Link>
  );
}
