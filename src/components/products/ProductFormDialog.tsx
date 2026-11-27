"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/store/AppProvider";
import { UNITS, UNIT_LABEL, type Product, type Unit } from "@/lib/types";
import type { ProductFormValues } from "@/lib/products";

const EMPTY: ProductFormValues = { name: "", price: "", unit: "kg", aliases: "" };

export function ProductFormDialog({
  open,
  onClose,
  product,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved?: (product: Product) => void;
}) {
  const { addProduct, updateProduct } = useApp();
  const { notify } = useToast();
  const [values, setValues] = useState<ProductFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      product
        ? {
            name: product.name,
            price: String(product.price),
            unit: product.unit,
            aliases: product.aliases.join(", "),
          }
        : EMPTY,
    );
  }, [open, product]);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    const result = product ? updateProduct(product.id, values) : addProduct(values);
    if (!result.ok) {
      setErrors(result.errors ?? { name: "Could not save this product." });
      return;
    }
    notify({
      tone: "success",
      message: product ? `${values.name.trim()} updated` : `${values.name.trim()} added to your catalogue`,
    });
    if (result.product) onSaved?.(result.product);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      description={
        product
          ? "Update the price, unit or the words you use when speaking."
          : "Add an item you sell, with the words you use to say it."
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} leadingIcon={<Save className="h-4 w-4" aria-hidden="true" />}>
            {product ? "Save changes" : "Add product"}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <TextField
          label="Product name"
          placeholder="e.g. Sugar"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          error={errors.name}
          autoComplete="off"
          maxLength={80}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Price per unit"
            placeholder="45"
            inputMode="decimal"
            value={values.price}
            onChange={(event) => set("price", event.target.value.replace(/[^0-9.]/g, ""))}
            error={errors.price}
            prefix="₹"
          />
          <SelectField
            label="Unit"
            value={values.unit}
            onChange={(event) => set("unit", event.target.value as Unit)}
            error={errors.unit}
          >
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABEL[unit]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Other names you speak"
          placeholder="chini, cheeni, shakkar, चीनी"
          value={values.aliases}
          onChange={(event) => set("aliases", event.target.value)}
          hint="Comma separated. Hindi, Hinglish and English names all help matching."
          autoComplete="off"
        />
        <div className="rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Example</p>
          <p className="mt-0.5">
            Say “3 kilo chini”. VoiceBill finds <span className="font-medium">Sugar</span> at ₹
            {values.price || "45"} per {UNIT_LABEL[values.unit]}.
          </p>
        </div>
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}
