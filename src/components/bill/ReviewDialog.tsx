"use client";

import { ArrowLeft, ReceiptText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/store/AppProvider";
import { formatMoney, formatQuantity } from "@/lib/units";
import { computeLineAmount } from "@/lib/billing";
import { UNIT_LABEL } from "@/lib/types";

export function ReviewDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { draft, draftTotals, settings } = useApp();
  const symbol = settings.currencySymbol;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review before saving"
      description="Check the items, quantities and total. Nothing is saved until you confirm."
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={onClose}
            leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Back to edit
          </Button>
          <Button
            onClick={onConfirm}
            leadingIcon={<ReceiptText className="h-4 w-4" aria-hidden="true" />}
          >
            Save bill
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-line">
        {draft.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
              <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-faint">
                {formatQuantity(item.quantity)} {UNIT_LABEL[item.unit]} × {formatMoney(item.unitPrice, symbol)}
              </p>
            </div>
            <p className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">
              {formatMoney(computeLineAmount(item.quantity, item.unitPrice), symbol)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-surface-soft px-3.5 py-3">
        <div className="flex justify-between text-[13px] text-ink-soft">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums text-ink">{formatMoney(draftTotals.subtotal, symbol)}</span>
        </div>
        {draftTotals.discountAmount > 0 ? (
          <div className="flex justify-between text-[13px] text-ink-soft">
            <span>Discount</span>
            <span className="font-medium tabular-nums text-brand-strong">
              − {formatMoney(draftTotals.discountAmount, symbol)}
            </span>
          </div>
        ) : null}
        <div className="mt-1 flex items-end justify-between border-t border-dashed border-line pt-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Total</span>
          <span className="font-display text-[24px] font-semibold leading-none tabular-nums text-ink">
            {formatMoney(draftTotals.total, symbol)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
        {draft.customerName.trim() ? (
          <>
            Billing to <span className="font-semibold text-ink-soft">{draft.customerName.trim()}</span>.{" "}
          </>
        ) : null}
        The receipt will use your shop details from Settings. You can print it, save a PDF or reprint it later
        from Bill history.
      </p>
    </Modal>
  );
}
