"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Database,
  Download,
  HardDrive,
  Info,
  Mic,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/store/AppProvider";
import { isSpeechSupported } from "@/lib/speech";
import { serializeBackup, backupFilename, downloadTextFile, parseBackup } from "@/lib/backup";
import { formatDateTime } from "@/lib/format";
import type { RecognitionLanguage, ReceiptWidth } from "@/lib/types";
import { cn } from "@/lib/cn";

function Section({
  icon,
  title,
  description,
  children,
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="vb-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            {icon}
          </span>
          <div>
            <h2 className="font-display text-[19px] leading-tight tracking-[-0.01em]">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">{description}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const {
    settings,
    products,
    bills,
    updateSettings,
    addSampleProducts,
    removeSampleProducts,
    importData,
    resetAllData,
  } = useApp();
  const { notify } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [shop, setShop] = useState({
    shopName: settings.shopName,
    address: settings.address,
    phone: settings.phone,
  });
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);

  useEffect(() => {
    setSpeechSupported(isSpeechSupported());
  }, []);

  useEffect(() => {
    setShop({ shopName: settings.shopName, address: settings.address, phone: settings.phone });
  }, [settings.shopName, settings.address, settings.phone]);

  const sampleCount = products.filter((product) => product.isSample).length;
  const dirty =
    shop.shopName !== settings.shopName ||
    shop.address !== settings.address ||
    shop.phone !== settings.phone;
  const shopNameValid = shop.shopName.trim().length > 0;

  const storageEstimate = useMemo(() => {
    try {
      const bytes = JSON.stringify({ products, bills, settings }).length * 2;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch {
      return "—";
    }
  }, [products, bills, settings]);

  const handleSaveShop = () => {
    if (!shopNameValid) {
      notify({ tone: "warning", message: "Enter your shop name before saving." });
      return;
    }
    updateSettings({
      shopName: shop.shopName.trim(),
      address: shop.address.trim(),
      phone: shop.phone.trim(),
    });
    notify({ tone: "success", message: "Shop details saved. New receipts will use them." });
  };

  const handleExport = () => {
    try {
      const json = serializeBackup({ products, bills, settings });
      downloadTextFile(backupFilename(), json);
      notify({
        tone: "success",
        message: `Backup downloaded — ${products.length} products and ${bills.length} bills.`,
      });
    } catch {
      notify({ tone: "error", message: "Could not create the backup file." });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify({ tone: "error", message: "That file is too large to be a VoiceBill backup." });
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        notify({ tone: "error", message: parsed.error });
        return;
      }
      setPendingImport(parsed);
      setImportOpen(true);
    } catch {
      notify({ tone: "error", message: "Could not read that file. Try exporting again." });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your shop"
        title="Settings"
        description="These details appear on every receipt. Everything is stored in this browser — no account, no server."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Section
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            title="Shop details"
            description="Printed on the top of every bill."
            aside={
              dirty ? (
                <span className="rounded-full border border-amber/25 bg-amber-soft px-2 py-1 text-[10.5px] font-semibold text-amber">
                  Unsaved changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/15 bg-brand-soft px-2 py-1 text-[10.5px] font-semibold text-brand-strong">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Saved
                </span>
              )
            }
          >
            <div className="space-y-3.5">
              <TextField
                label="Shop name"
                value={shop.shopName}
                onChange={(event) => setShop((current) => ({ ...current, shopName: event.target.value }))}
                maxLength={80}
                placeholder="e.g. Sharma Kirana Store"
                error={!shopNameValid && dirty ? "Shop name cannot be empty." : undefined}
              />
              <TextAreaField
                label="Address"
                optional
                value={shop.address}
                onChange={(event) => setShop((current) => ({ ...current, address: event.target.value }))}
                rows={2}
                maxLength={300}
                placeholder="Shop no., street, market, city, PIN"
              />
              <TextField
                label="Phone number"
                optional
                value={shop.phone}
                onChange={(event) => setShop((current) => ({ ...current, phone: event.target.value }))}
                inputMode="tel"
                maxLength={40}
                placeholder="98765 43210"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[11.5px] text-ink-faint">
                  Receipts reprint with the shop details saved at billing time.
                </p>
                <Button
                  onClick={handleSaveShop}
                  disabled={!dirty}
                  leadingIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                >
                  Save details
                </Button>
              </div>
            </div>
          </Section>

          <Section
            icon={<Printer className="h-4 w-4" aria-hidden="true" />}
            title="Receipt & currency"
            description="Changes save automatically."
          >
            <div className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <SelectField
                  label="Currency symbol"
                  value={settings.currencySymbol}
                  onChange={(event) => updateSettings({ currencySymbol: event.target.value })}
                  hint="Used on screen and on receipts."
                >
                  <option value="₹">Indian Rupee (₹)</option>
                  <option value="Rs">Rupees (Rs)</option>
                  <option value="$">US Dollar ($)</option>
                  <option value="€">Euro (€)</option>
                </SelectField>
                <div>
                  <span className="vb-label">Default receipt width</span>
                  <Segmented
                    ariaLabel="Default receipt width"
                    value={settings.receiptWidth}
                    onChange={(value: ReceiptWidth) => updateSettings({ receiptWidth: value })}
                    options={[
                      { value: "58mm", label: "58 mm" },
                      { value: "80mm", label: "80 mm" },
                      { value: "a4", label: "A4" },
                    ]}
                    className="mt-1"
                  />
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Used by the print dialog. You can switch size in any receipt preview.
                  </p>
                </div>
              </div>

              <TextField
                label="Thank-you message"
                value={settings.thankYouMessage}
                onChange={(event) => updateSettings({ thankYouMessage: event.target.value })}
                maxLength={200}
                placeholder="Thank you! Visit again."
                hint="Shown at the bottom of every receipt."
              />

              <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  <Printer className="h-3 w-3" aria-hidden="true" />
                  Thermal printing tips
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                  Choose 58 mm or 80 mm for thermal printers, A4 for a normal sheet. In the print dialog select
                  your printer, set margins to “None” or “Minimum” and scale 100%. “Save as PDF” stores a PDF copy.
                </p>
              </div>
            </div>
          </Section>

          <Section
            icon={<Mic className="h-4 w-4" aria-hidden="true" />}
            title="Voice & language"
            description="Hindi and English recognition, with a typing fallback."
          >
            <div className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <span className="vb-label">Default recognition language</span>
                  <Segmented
                    ariaLabel="Default recognition language"
                    value={settings.language}
                    onChange={(value: RecognitionLanguage) => updateSettings({ language: value })}
                    options={[
                      { value: "hi-IN", label: "हिंदी" },
                      { value: "en-IN", label: "English" },
                    ]}
                    className="mt-1"
                  />
                  <p className="mt-1.5 text-xs text-ink-faint">
                    You can switch language on the New Bill screen anytime.
                  </p>
                </div>
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11.5px] leading-relaxed",
                    speechSupported
                      ? "border-brand/15 bg-brand-tint text-brand-strong"
                      : "border-amber/25 bg-amber-soft text-amber",
                  )}
                >
                  <Volume2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">
                      {speechSupported ? "Voice input is available" : "Voice input not supported here"}
                    </p>
                    <p className="mt-0.5">
                      {speechSupported
                        ? "Your browser does the speech recognition. VoiceBill never uploads recordings."
                        : "Use Chrome or Android Chrome for voice. Typing works everywhere."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <Toggle
                  checked={settings.autoAddVoice}
                  onChange={(value) => {
                    updateSettings({ autoAddVoice: value });
                    notify({
                      tone: "info",
                      message: value
                        ? "Spoken items will be added to the bill automatically."
                        : "Spoken items will wait for you to review them first.",
                    });
                  }}
                  label="Add spoken items automatically"
                  description="When on, each finished sentence is matched and added to the bill. Turn off to edit the transcript before adding."
                />
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Speech recognition is provided by the browser and is not perfect, especially with Hinglish. Always
                check the detected items before saving a bill.
              </p>
            </div>
          </Section>

          <Section
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            title="Data & backup"
            description="Products, bills and settings live in this browser."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Products</p>
                  <p className="mt-1 font-display text-[20px] font-semibold leading-none tabular-nums">
                    {products.length}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Bills</p>
                  <p className="mt-1 font-display text-[20px] font-semibold leading-none tabular-nums">
                    {bills.length}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Storage</p>
                  <p className="mt-1 font-display text-[20px] font-semibold leading-none tabular-nums">
                    {storageEstimate}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleExport}
                  variant="secondary"
                  fullWidth
                  leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
                >
                  Export backup (JSON)
                </Button>
                <Button
                  onClick={() => fileRef.current?.click()}
                  variant="secondary"
                  fullWidth
                  leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                >
                  Import backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleFile(file);
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-soft px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">
                    Sample catalogue {sampleCount > 0 ? `(${sampleCount} items)` : ""}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">
                    Optional starter products with example prices. Remove them once your own catalogue is ready.
                  </p>
                </div>
                {sampleCount > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setSamplesOpen(true)}>
                    Remove samples
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const added = addSampleProducts();
                      notify({
                        tone: added > 0 ? "success" : "info",
                        message:
                          added > 0
                            ? `${added} sample products added. Edit their prices in Products.`
                            : "Sample products are already in your catalogue.",
                      });
                    }}
                  >
                    Add samples
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-danger/20 bg-danger-soft/50 px-3 py-3">
                <p className="text-[12.5px] font-semibold text-danger">Danger zone</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">
                  Clear every product, bill and setting from this browser. Export a backup first.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-2"
                  onClick={() => setResetOpen(true)}
                  leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Erase all data
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-brand/15 bg-brand-tint px-4 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private by design
            </p>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
              <li>· No account, no server, no API keys.</li>
              <li>· Voice is handled by your browser, not uploaded by VoiceBill.</li>
              <li>· Data stays in this browser’s local storage.</li>
              <li>· Receipts print through your browser’s print dialog.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">
              <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
              Storage limits
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
              Local storage is usually limited to about 5 MB per site. That is thousands of bills, but clearing
              browser data or using private mode will remove it. Export a backup regularly.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">About VoiceBill</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
              Version 1.0 · Just speak, get your bill. Built for Indian kirana shops, general stores and local
              retailers.
            </p>
            <p className="mt-2 text-[11px] text-ink-faint">
              {bills.length > 0
                ? `Last saved bill: ${formatDateTime(bills[0]!.createdAt)}`
                : "No bills saved yet."}
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setPendingImport(null);
        }}
        onConfirm={() => {
          if (!pendingImport || !pendingImport.ok) return;
          importData({
            products: pendingImport.products,
            bills: pendingImport.bills,
            settings: pendingImport.settings,
          });
          notify({
            tone: "success",
            message: `Backup restored — ${pendingImport.products.length} products and ${pendingImport.bills.length} bills.`,
          });
          setPendingImport(null);
        }}
        title="Replace data with this backup?"
        description="Your current products, bills and settings on this device will be replaced. Export a backup first if unsure."
        confirmLabel="Restore backup"
        destructive
      >
        {pendingImport && pendingImport.ok ? (
          <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            <p>
              <span className="font-semibold text-ink">{pendingImport.products.length}</span> products ·{" "}
              <span className="font-semibold text-ink">{pendingImport.bills.length}</span> bills
            </p>
            <p className="mt-1">Shop: {pendingImport.settings.shopName || "—"}</p>
            {pendingImport.exportedAt ? (
              <p className="mt-0.5 text-ink-faint">Exported {formatDateTime(pendingImport.exportedAt)}</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        onConfirm={() => {
          const removed = removeSampleProducts();
          notify({
            tone: "info",
            message: `${removed} sample product${removed === 1 ? "" : "s"} removed.`,
          });
        }}
        title="Remove sample products?"
        description="Only products marked as sample data will be removed. Your own products and saved bills stay untouched."
        confirmLabel="Remove samples"
        destructive
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetAllData();
          notify({ tone: "info", message: "All local data erased." });
          router.replace("/setup");
        }}
        title="Erase all data?"
        description="Every product, bill and setting stored in this browser will be deleted. This cannot be undone."
        confirmLabel="Erase everything"
        destructive
      />
    </div>
  );
}
