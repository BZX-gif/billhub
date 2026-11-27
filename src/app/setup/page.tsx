"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Mic, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { BrandLockup } from "@/components/Logo";
import { useToast } from "@/components/ui/Toast";
import type { RecognitionLanguage, ReceiptWidth } from "@/lib/types";

export default function SetupPage() {
  const { completeSetup, settings } = useApp();
  const { notify } = useToast();
  const router = useRouter();
  const [shopName, setShopName] = useState(settings.shopName === "My Shop" ? "" : settings.shopName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [language, setLanguage] = useState<RecognitionLanguage>(settings.language);
  const [receiptWidth, setReceiptWidth] = useState<ReceiptWidth>(settings.receiptWidth);
  const [includeSamples, setIncludeSamples] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only leave this screen if setup was already finished before mounting.
  // (Completing setup here navigates to the new bill screen instead.)
  const wasCompleteOnMount = useRef(settings.setupComplete);

  useEffect(() => {
    if (wasCompleteOnMount.current) router.replace("/");
  }, [router]);

  const finish = (samples: boolean, name?: string) => {
    completeSetup({
      shopName: name ?? shopName,
      address,
      phone,
      language,
      receiptWidth,
      includeSamples: samples,
    });
    notify({ tone: "success", message: "Shop ready. Let’s make your first bill." });
    router.replace("/new-bill");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!shopName.trim()) {
      setError("Enter your shop name to continue.");
      return;
    }
    setError(null);
    finish(includeSamples);
  };

  return (
    <main className="min-h-dvh bg-canvas">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[1.02fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#f0f7f2_0%,#fbf7ec_60%,#f7efe0_100%)] px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/5" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-amber/5" aria-hidden="true" />
          <div className="relative">
            <BrandLockup />
            <h1 className="mt-12 max-w-sm font-display text-[clamp(2rem,3.4vw,2.75rem)] font-medium leading-[1.04] tracking-[-0.035em] text-ink">
              Just speak.
              <br />
              Get your bill.
            </h1>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">
              VoiceBill turns a sentence into a priced, printable bill for your kirana shop — in Hindi, Hinglish or
              English.
            </p>

            <div className="mt-8 max-w-sm rounded-2xl border border-line bg-white/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[13px] font-medium leading-snug text-ink" lang="hi">
                  “3 किलो चीनी, 2 किलो आटा और 3 लीटर तेल”
                </p>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
                {[
                  ["Sugar", "3 kg", "₹135.00"],
                  ["Wheat Flour (Aata)", "2 kg", "₹80.00"],
                  ["Soybean Oil", "3 litre", "₹390.00"],
                ].map(([name, qty, amount]) => (
                  <div key={name} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate font-medium text-ink">{name}</span>
                    <span className="shrink-0 text-ink-faint">{qty}</span>
                    <span className="w-[64px] shrink-0 text-right font-semibold tabular-nums text-ink">{amount}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-line pt-1.5 text-[12.5px]">
                  <span className="font-semibold uppercase tracking-[0.1em] text-ink-faint">Total</span>
                  <span className="font-display text-[18px] font-semibold tabular-nums">₹605.00</span>
                </div>
              </div>
            </div>
          </div>

          <ul className="relative mt-10 space-y-3">
            {[
              { icon: Mic, text: "Speak in Hindi, Hinglish or English" },
              { icon: Printer, text: "Print on 58 mm, 80 mm or A4" },
              { icon: ShieldCheck, text: "No account, no uploads, data stays here" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink-soft">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand shadow-sm">
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex items-start justify-center px-4 py-7 sm:px-8 lg:items-center lg:py-10">
          <div className="w-full max-w-md">
            <div className="mb-7 lg:hidden">
              <BrandLockup compact />
            </div>

            <p className="vb-caps text-brand">First-time setup</p>
            <h2 className="mt-1.5 font-display text-[clamp(1.8rem,5vw,2.3rem)] font-medium leading-[1.08] tracking-[-0.03em] text-ink">
              Set up your shop
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
              This goes on your receipts. It takes about 30 seconds, and you can change everything later.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TextField
                label="Shop name"
                value={shopName}
                onChange={(event) => {
                  setShopName(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Sharma Kirana Store"
                maxLength={80}
                error={error ?? undefined}
                autoComplete="organization"
                autoFocus
              />
              <TextAreaField
                label="Shop address"
                optional
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Shop no., street, market, city, PIN"
              />
              <TextField
                label="Phone number"
                optional
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                maxLength={40}
                placeholder="98765 43210"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="vb-label">Speak in</span>
                  <Segmented
                    ariaLabel="Recognition language"
                    value={language}
                    onChange={setLanguage}
                    options={[
                      { value: "hi-IN", label: "हिंदी" },
                      { value: "en-IN", label: "English" },
                    ]}
                    className="mt-1"
                  />
                </div>
                <SelectField
                  label="Receipt printer"
                  value={receiptWidth}
                  onChange={(event) => setReceiptWidth(event.target.value as ReceiptWidth)}
                >
                  <option value="80mm">80 mm thermal</option>
                  <option value="58mm">58 mm thermal</option>
                  <option value="a4">A4 / normal paper</option>
                </SelectField>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors hover:border-brand/25">
                <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={includeSamples}
                    onChange={(event) => setIncludeSamples(event.target.checked)}
                    className="peer h-5 w-5 appearance-none rounded-md border border-line-strong bg-white checked:border-brand checked:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  />
                  <Check
                    className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink">
                    Start with sample products
                    <span className="rounded-full border border-amber/25 bg-amber-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber">
                      Sample data
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-faint">
                    18 common kirana items with example prices and Hindi aliases. Clearly marked as sample, so you
                    can edit or remove them anytime — they never replace your own products.
                  </span>
                </span>
              </label>

              <Button type="submit" size="lg" fullWidth trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Start billing
              </Button>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => finish(false, "My Shop")}
                  className="text-[12px] font-semibold text-ink-faint underline decoration-line-strong underline-offset-2 hover:text-ink-soft"
                >
                  Skip for now
                </button>
                <p className="flex items-center gap-1 text-[10.5px] text-ink-faint">
                  <Sparkles className="h-3 w-3 text-brand" aria-hidden="true" />
                  No account needed
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
