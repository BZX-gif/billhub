"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/store/AppProvider";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { normalizeText } from "@/lib/text";
import { formatMoney, formatQuantity } from "@/lib/units";
import { UNITS, UNIT_LABEL, type DraftItem, type Product, type Unit } from "@/lib/types";

type PickerMode = "catalogue" | "custom";

export function ProductPickerDialog({
  open,
  onClose,
  item,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  /** The unresolved line (resolve mode) — omit when adding a fresh item. */
  item?: DraftItem | null;
  mode: "resolve" | "add";
}) {
  const { products, resolveDraftItem, addProductToDraft, addCustomItem, customiseDraftItem, updateDraftItem, settings } =
    useApp();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PickerMode>("catalogue");
  const [createOpen, setCreateOpen] = useState(false);
  const [custom, setCustom] = useState({
    name: "",
    price: "",
    quantity: "1",
    unit: "piece" as Unit,
  });
  const [customError, setCustomError] = useState<string | null>(null);
  const symbol = settings.currencySymbol;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTab("catalogue");
    setCustomError(null);
    setCustom({
      name: item?.name ?? "",
      price: item && item.unitPrice > 0 ? String(item.unitPrice) : "",
      quantity: formatQuantity(item?.quantity ?? 1),
      unit: item?.unit ?? "piece",
    });
  }, [open, item]);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    const scored = [...products];
    if (item?.alternatives?.length) {
      const rank = new Map(item.alternatives.map((alt, index) => [alt.productId, index]));
      scored.sort((a, b) => {
        const aRank = rank.get(a.id) ?? 99;
        const bRank = rank.get(b.id) ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return a.name.localeCompare(b.name);
      });
    } else {
      scored.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (!normalized) return scored;
    return scored.filter((product) => {
      const haystack = normalizeText([product.name, ...product.aliases].join(" "));
      return haystack.includes(normalized);
    });
  }, [products, query, item]);

  const handleSelect = (product: Product) => {
    if (mode === "resolve" && item) {
      resolveDraftItem(item.id, product.id);
      notify({ tone: "success", message: `${product.name} set for this line` });
    } else {
      addProductToDraft(product.id);
      notify({ tone: "success", message: `${product.name} added` });
    }
    onClose();
  };

  const handleCustom = () => {
    const name = custom.name.trim();
    const price = Number.parseFloat(custom.price);
    const quantity = Number.parseFloat(custom.quantity);
    if (!name) {
      setCustomError("Enter the item name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setCustomError("Enter a price above 0.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCustomError("Enter a quantity above 0.");
      return;
    }
    if (mode === "resolve" && item) {
      customiseDraftItem(item.id, price);
      updateDraftItem(item.id, { name, quantity, unit: custom.unit });
      notify({ tone: "success", message: `${name} added as a custom item` });
    } else {
      addCustomItem({ name, price, quantity, unit: custom.unit });
      notify({ tone: "success", message: `${name} added` });
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={mode === "resolve" ? "Which product is this?" : "Add a product"}
        description={
          mode === "resolve" && item
            ? `Heard “${item.name}”${item.rawText ? ` from “${item.rawText}”` : ""}. Choose the right product — prices come from your catalogue.`
            : "Pick from your catalogue or add a one-off custom item."
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {tab === "custom" ? <Button onClick={handleCustom}>Add custom item</Button> : null}
          </div>
        }
      >
        <div className="space-y-3">
          {!products.length ? (
            <div className="rounded-xl border border-amber/25 bg-amber-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-amber">
              Your catalogue is empty. Add a product first — VoiceBill never guesses prices.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              ariaLabel="Choose source"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: "catalogue", label: "Catalogue" },
                { value: "custom", label: "Custom item" },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateOpen(true)}
              leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              New product
            </Button>
          </div>

          {tab === "catalogue" ? (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products or aliases…"
                  aria-label="Search products"
                  className="vb-input pl-9"
                  autoFocus
                />
              </div>

              <ul className="vb-scroll max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                {filtered.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(product)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand/30 hover:bg-brand-tint"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-semibold text-ink">{product.name}</span>
                          {product.isSample ? (
                            <span className="rounded bg-canvas px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-faint">
                              Sample
                            </span>
                          ) : null}
                        </span>
                        {product.aliases.length ? (
                          <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                            {product.aliases.slice(0, 4).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[13px] font-semibold tabular-nums text-ink">
                          {formatMoney(product.price, symbol)}
                        </span>
                        <span className="block text-[10.5px] text-ink-faint">per {UNIT_LABEL[product.unit]}</span>
                      </span>
                      <Check className="h-4 w-4 shrink-0 text-brand opacity-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              {filtered.length === 0 && products.length > 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong bg-surface-soft px-3 py-4 text-center text-[13px] text-ink-soft">
                  No product matches “{query}”.{" "}
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="font-semibold text-brand-strong underline underline-offset-2"
                  >
                    Create it
                  </button>
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  Custom item
                </span>{" "}
                — for something you sell occasionally that isn’t in your catalogue. It is saved with this bill only.
              </div>
              <TextField
                label="Item name"
                value={custom.name}
                onChange={(event) => setCustom((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Loose incense sticks"
                maxLength={80}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Price per unit"
                  inputMode="decimal"
                  prefix={symbol}
                  value={custom.price}
                  onChange={(event) =>
                    setCustom((current) => ({ ...current, price: event.target.value.replace(/[^0-9.]/g, "") }))
                  }
                  placeholder="20"
                />
                <TextField
                  label="Quantity"
                  inputMode="decimal"
                  value={custom.quantity}
                  onChange={(event) =>
                    setCustom((current) => ({ ...current, quantity: event.target.value.replace(/[^0-9.]/g, "") }))
                  }
                />
              </div>
              <SelectField
                label="Unit"
                value={custom.unit}
                onChange={(event) => setCustom((current) => ({ ...current, unit: event.target.value as Unit }))}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABEL[unit]}
                  </option>
                ))}
              </SelectField>
              {customError ? (
                <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">
                  {customError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      <ProductFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(product) => {
          setCreateOpen(false);
          handleSelect(product);
        }}
      />
    </>
  );
}
