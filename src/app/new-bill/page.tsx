"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  History,
  Mic,
  Package,
  Plus,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/store/AppProvider";
import { VoiceCapture } from "@/components/bill/VoiceCapture";
import { BillItemRow } from "@/components/bill/BillItemRow";
import { BillSummary } from "@/components/bill/BillSummary";
import { ReviewDialog } from "@/components/bill/ReviewDialog";
import { ProductPickerDialog } from "@/components/bill/ProductPickerDialog";
import { ReceiptDialog } from "@/components/receipt/ReceiptDialog";
import { formatMoneyShort } from "@/lib/units";
import { UNIT_LABEL, type Bill, type DraftItem } from "@/lib/types";

export default function NewBillPage() {
  const {
    products,
    settings,
    draft,
    hydrated,
    addProductToDraft,
    addSampleProducts,
    clearDraft,
    finalizeBill,
    draftTotals,
    draftValidation,
  } = useApp();
  const { notify } = useToast();
  const [picker, setPicker] = useState<{ mode: "resolve" | "add"; item?: DraftItem } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);
  const [restored, setRestored] = useState(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;
    // Only items that arrived with the saved draft count as "restored".
    if (draft.items.length > 0) setRestored(true);
  }, [hydrated, draft.items.length]);

  const quickAdd = products
    .filter((product) => product.isSample)
    .slice(0, 6)
    .concat(products.filter((product) => !product.isSample))
    .slice(0, 8);

  const handleReview = () => {
    if (!draftValidation.canFinalize) {
      notify({
        tone: "warning",
        message: draftValidation.issues[0]?.message ?? "Complete the bill before saving.",
      });
      return;
    }
    setReviewOpen(true);
  };

  const handleConfirm = () => {
    const result = finalizeBill();
    if (!result.ok) {
      notify({ tone: "error", message: result.error });
      return;
    }
    setReviewOpen(false);
    setReceiptBill(result.bill);
    setRestored(false);
    notify({ tone: "success", message: `Bill ${result.bill.number} saved` });
  };

  const handleSampleLoad = () => {
    const added = addSampleProducts();
    notify({
      tone: added > 0 ? "success" : "info",
      message:
        added > 0
          ? `${added} sample products added — edit prices to match your shop.`
          : "Sample products are already in your catalogue.",
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="New bill"
        title="Speak. Review. Bill."
        description="Say the items in Hindi, Hinglish or English. VoiceBill matches your catalogue, prices every line and prepares the receipt."
        actions={
          <>
            <Link href="/history" className="hidden sm:block">
              <Button variant="ghost" size="md" leadingIcon={<History className="h-4 w-4" aria-hidden="true" />}>
                Bill history
              </Button>
            </Link>
            <Button
              variant="secondary"
              leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setPicker({ mode: "add" })}
            >
              Add product
            </Button>
          </>
        }
      />

      {restored ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/15 bg-brand-tint px-3 py-2 text-[12px] font-medium text-brand-strong">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Draft restored from this device — continue where you left off.
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber/25 bg-amber-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <ShoppingBasket className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
            <div>
              <p className="text-[13.5px] font-semibold text-amber">Your product catalogue is empty</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-amber/90">
                Add the items you sell (with prices) or load the sample catalogue and edit it.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={handleSampleLoad}>
              Load samples
            </Button>
            <Link href="/products">
              <Button size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>
                Add product
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0 space-y-4">
          <VoiceCapture />

          <section className="vb-card min-w-0 overflow-hidden" aria-labelledby="items-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <h2 id="items-heading" className="font-display text-[19px] leading-none tracking-[-0.01em]">
                  Bill items
                </h2>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  {draft.items.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPicker({ mode: "add" })}
                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Add item
              </Button>
            </div>

            {draft.items.length === 0 ? (
              <div className="p-3 sm:p-4">
                <EmptyState
                  icon={<Mic className="h-5 w-5" aria-hidden="true" />}
                  title="No items yet"
                  description="Tap the mic and say “3 kilo chini aur 2 kilo aata”, or add products manually."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => setPicker({ mode: "add" })}
                      leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    >
                      Add product manually
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="space-y-2.5 p-3 sm:p-4">
                {draft.items.map((item, index) => (
                  <BillItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    onChooseProduct={(target) => setPicker({ mode: "resolve", item: target })}
                  />
                ))}
              </ul>
            )}

            {draft.items.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-soft/60 px-4 py-3 text-[11.5px] text-ink-faint sm:px-5">
                <span>
                  Tap any quantity or price to correct it. Every line must have a product and a price.
                </span>
                <button
                  type="button"
                  onClick={() => setPicker({ mode: "add" })}
                  className="inline-flex items-center gap-1 font-semibold text-brand-strong"
                >
                  Add another
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>

          {quickAdd.length > 0 ? (
            <section className="vb-card min-w-0 px-4 py-3.5 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                  <p className="vb-caps mb-0">Quick add</p>
                </div>
                <Link href="/products" className="text-[11.5px] font-semibold text-brand-strong hover:underline">
                  Manage products
                </Link>
              </div>
              <div className="vb-scroll mt-2.5 flex w-full max-w-full gap-2 overflow-x-auto pb-1">
                {quickAdd.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToDraft(product.id)}
                    className="group flex shrink-0 flex-col items-start rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-brand/30 hover:bg-brand-tint"
                  >
                    <span className="max-w-[130px] truncate text-[12.5px] font-semibold text-ink">
                      {product.name}
                    </span>
                    <span className="text-[10.5px] tabular-nums text-ink-faint">
                      {formatMoneyShort(product.price, settings.currencySymbol)} / {UNIT_LABEL[product.unit]}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

        </div>

        <BillSummary onReview={handleReview} onClear={() => setClearOpen(true)} />
      </div>

      <p className="pb-2 text-center text-[11px] text-ink-faint lg:text-left">
        Total is calculated from actual quantities × catalogue prices. Discounts are optional. Nothing leaves this
        device.
      </p>

      <ProductPickerDialog
        open={Boolean(picker)}
        mode={picker?.mode ?? "add"}
        item={picker?.item}
        onClose={() => setPicker(null)}
      />

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirm}
      />

      <ReceiptDialog open={Boolean(receiptBill)} bill={receiptBill} onClose={() => setReceiptBill(null)} />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearDraft();
          setRestored(false);
          notify({ tone: "info", message: "Bill cleared. Your products and saved bills are untouched." });
        }}
        title="Clear this bill?"
        description="All items and the discount in the current bill will be removed. Products and saved bills stay safe."
        confirmLabel="Clear bill"
        destructive
      >
        <p className="text-[13px] text-ink-soft">
          {draft.items.length} item{draft.items.length === 1 ? "" : "s"} worth{" "}
          <span className="font-semibold text-ink">
            {formatMoneyShort(draftTotals.total, settings.currencySymbol)}
          </span>{" "}
          will be removed from this draft.
        </p>
      </ConfirmDialog>
    </div>
  );
}
