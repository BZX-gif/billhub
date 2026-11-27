"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Printer, X } from "lucide-react";
import { Receipt, RECEIPT_WIDTH_LABEL } from "./Receipt";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/store/AppProvider";
import type { Bill, ReceiptWidth } from "@/lib/types";

const PAGE_SETUP: Record<ReceiptWidth, { page: string; margin: string }> = {
  "58mm": { page: "58mm auto", margin: "2mm" },
  "80mm": { page: "80mm auto", margin: "2mm" },
  a4: { page: "A4", margin: "12mm" },
};

export function ReceiptDialog({
  bill,
  open,
  onClose,
}: {
  bill: Bill | null;
  open: boolean;
  onClose: () => void;
}) {
  const { settings } = useApp();
  const { notify } = useToast();
  const [previewWidth, setPreviewWidth] = useState<ReceiptWidth>(settings.receiptWidth);

  useEffect(() => {
    if (open) setPreviewWidth(settings.receiptWidth);
  }, [open, settings.receiptWidth]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const printReceipt = useCallback(
    (mode: "print" | "pdf") => {
      if (!bill) return;
      const originalTitle = document.title;
      document.title = `VoiceBill-${bill.number}`;
      const restore = () => {
        document.title = originalTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
      window.setTimeout(restore, 4000);
      if (mode === "pdf") {
        notify({
          tone: "info",
          message: "In the print dialog, choose “Save as PDF” as the destination.",
          duration: 6000,
        });
      }
      window.print();
    },
    [bill, notify],
  );

  if (!open || !bill || typeof document === "undefined") return null;

  const page = PAGE_SETUP[previewWidth];

  return createPortal(
    <div className="receipt-modal fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <style>{`@media print { @page { size: ${page.page}; margin: ${page.margin}; } }`}</style>
      <div
        className="no-print absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt ${bill.number}`}
        className="receipt-panel relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-lift)] sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="no-print flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="vb-caps text-brand">Receipt preview</p>
            <h2 className="truncate font-display text-[20px] leading-tight tracking-[-0.01em]">
              {bill.number}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              ariaLabel="Receipt paper size"
              value={previewWidth}
              onChange={setPreviewWidth}
              options={[
                { value: "58mm", label: "58 mm" },
                { value: "80mm", label: "80 mm" },
                { value: "a4", label: "A4" },
              ]}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="receipt-scroll vb-scroll flex-1 overflow-y-auto bg-[#efe9dd] px-3 py-5">
          <div className="print-area mx-auto w-fit max-w-full shadow-[0_18px_40px_-24px_rgba(36,31,23,0.55)]">
            <Receipt bill={bill} width={previewWidth} />
          </div>
        </div>

        <footer className="no-print border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] leading-snug text-ink-faint">
              Printing at <span className="font-semibold text-ink-soft">{RECEIPT_WIDTH_LABEL[previewWidth]}</span>.
              Change the default paper size in Settings.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                leadingIcon={<FileDown className="h-4 w-4" aria-hidden="true" />}
                onClick={() => printReceipt("pdf")}
                className="flex-1 sm:flex-none"
              >
                Save as PDF
              </Button>
              <Button
                leadingIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                onClick={() => printReceipt("print")}
                className="flex-1 sm:flex-none"
              >
                Print bill
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
