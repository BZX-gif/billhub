"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mic, Package, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { useApp } from "@/store/AppProvider";
import { formatMoney } from "@/lib/units";
import { normalizeText } from "@/lib/text";
import { UNIT_LABEL, type Product } from "@/lib/types";

export default function ProductsPage() {
  const { products, settings, deleteProduct, addSampleProducts, removeSampleProducts } = useApp();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [removeSamplesOpen, setRemoveSamplesOpen] = useState(false);
  const symbol = settings.currencySymbol;

  const sampleCount = products.filter((product) => product.isSample).length;

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    if (!normalized) return sorted;
    return sorted.filter((product) =>
      normalizeText([product.name, ...product.aliases].join(" ")).includes(normalized),
    );
  }, [products, query]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Products & prices"
        description="Every product has one price and unit. Add the Hindi or local words you use when speaking so VoiceBill recognises them."
        actions={
          <>
            {sampleCount > 0 ? (
              <Button variant="ghost" onClick={() => setRemoveSamplesOpen(true)}>
                Sample data ({sampleCount})
              </Button>
            ) : null}
            <Button onClick={openAdd} leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Add product
            </Button>
          </>
        }
      />

      <div className="vb-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products or aliases…"
              aria-label="Search products"
              className="vb-input h-10 pl-9 pr-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-faint hover:bg-canvas hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p className="text-[11.5px] font-medium text-ink-faint">
            {filtered.length} of {products.length} product{products.length === 1 ? "" : "s"}
            {sampleCount > 0 ? ` · ${sampleCount} sample` : ""}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-3 sm:p-4">
            {products.length === 0 ? (
              <EmptyState
                icon={<Package className="h-5 w-5" aria-hidden="true" />}
                title="No products yet"
                description="Add the items you sell with their price and unit. VoiceBill uses this catalogue to price spoken bills — it never invents a price."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={openAdd} leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                      Add your first product
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const added = addSampleProducts();
                        notify({
                          tone: "success",
                          message: `${added} sample products added — edit the prices to match your shop.`,
                        });
                      }}
                      leadingIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                    >
                      Load sample catalogue
                    </Button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                compact
                icon={<Search className="h-5 w-5" aria-hidden="true" />}
                title={`No product matches “${query}”`}
                description="Try another word, or add this product to your catalogue."
                action={
                  <Button size="sm" onClick={openAdd} leadingIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>
                    Add product
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-soft/60 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas font-display text-[15px] font-semibold text-ink-soft">
                    {product.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[14.5px] font-semibold text-ink">{product.name}</p>
                      {product.isSample ? (
                        <span className="rounded-full border border-amber/25 bg-amber-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber">
                          Sample
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {product.aliases.length > 0 ? (
                        <>
                          {product.aliases.slice(0, 5).map((alias) => (
                            <span
                              key={alias}
                              className="rounded-full border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-soft"
                            >
                              {alias}
                            </span>
                          ))}
                          {product.aliases.length > 5 ? (
                            <span className="text-[10.5px] font-medium text-ink-faint">
                              +{product.aliases.length - 5}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[11px] text-ink-faint">No alternative names yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className="whitespace-nowrap">
                    <span className="font-display text-[18px] font-semibold tabular-nums text-ink">
                      {formatMoney(product.price, symbol)}
                    </span>
                    <span className="ml-1 text-[11px] font-medium text-ink-faint">
                      / {UNIT_LABEL[product.unit]}
                    </span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-brand-soft hover:text-brand-strong"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(product)}
                      aria-label={`Delete ${product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Mic className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-semibold text-ink">How spoken matching works</p>
            <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-ink-soft">
              VoiceBill compares what you say with the product name and its alternative names. Add words like
              “chini”, “cheeni” or “चीनी” to Sugar so it is found instantly. If nothing matches confidently, the
              line is marked for review instead of guessing.
            </p>
          </div>
        </div>
        <Link href="/new-bill" className="shrink-0">
          <Button size="sm" variant="secondary">
            Try it now
          </Button>
        </Link>
      </section>

      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteProduct(deleting.id);
          notify({ tone: "info", message: `${deleting.name} removed from your catalogue.` });
        }}
        title={`Delete ${deleting?.name ?? "product"}?`}
        description="Past bills keep their own copy of the name and price. If this product is in the current draft, that line will need a new product."
        confirmLabel="Delete product"
        destructive
      />

      <ConfirmDialog
        open={removeSamplesOpen}
        onClose={() => setRemoveSamplesOpen(false)}
        onConfirm={() => {
          const removed = removeSampleProducts();
          notify({ tone: "info", message: `${removed} sample product${removed === 1 ? "" : "s"} removed.` });
        }}
        title="Remove sample products?"
        description="Only products marked as sample data will be removed. Your own products and saved bills stay untouched."
        confirmLabel="Remove samples"
        destructive
      />
    </div>
  );
}
