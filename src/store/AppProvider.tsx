"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  createBill,
  nextBillSequence,
  summarizeToday,
  totalsForDraft,
  validateDraft,
  type BillTotals,
  type DraftValidation,
} from "@/lib/billing";
import { createId } from "@/lib/ids";
import { validateProductInput, productFromInput, type ProductFormValues } from "@/lib/products";
import { applyProductToItem, markItemAsCustom, syncItemWithProduct } from "@/lib/resolve";
import { createSampleProducts } from "@/lib/sampleData";
import {
  clearLocalData,
  getBrowserStorage,
  loadAppData,
  saveBills,
  saveDraft,
  saveProducts,
  saveSettings,
  type StorageLike,
} from "@/lib/storage";
import { emptyDraft, DEFAULT_SETTINGS } from "@/lib/types";
import type {
  AppData,
  Bill,
  DiscountType,
  Draft,
  DraftItem,
  Product,
  Settings,
  Unit,
} from "@/lib/types";
import { isUnit, roundMoney } from "@/lib/units";

export interface CustomItemInput {
  name: string;
  price: number;
  quantity: number;
  unit: Unit;
}

export interface AppContextValue {
  hydrated: boolean;
  storageAvailable: boolean;
  saveError: string | null;
  products: Product[];
  bills: Bill[];
  settings: Settings;
  draft: Draft;
  draftTotals: BillTotals;
  draftValidation: DraftValidation;
  todaySummary: { sales: number; billCount: number; itemCount: number };

  addProduct: (values: ProductFormValues) => {
    ok: boolean;
    product?: Product;
    errors?: Record<string, string>;
  };
  updateProduct: (id: string, values: ProductFormValues) => {
    ok: boolean;
    product?: Product;
    errors?: Record<string, string>;
  };
  deleteProduct: (id: string) => void;
  addSampleProducts: () => number;
  removeSampleProducts: () => number;

  updateSettings: (patch: Partial<Settings>) => void;
  completeSetup: (input: {
    shopName: string;
    address: string;
    phone: string;
    language?: Settings["language"];
    receiptWidth?: Settings["receiptWidth"];
    includeSamples: boolean;
  }) => void;

  addDraftItems: (items: DraftItem[]) => void;
  updateDraftItem: (id: string, patch: Partial<DraftItem>) => void;
  removeDraftItem: (id: string) => void;
  resolveDraftItem: (id: string, productId: string) => void;
  customiseDraftItem: (id: string, price: number) => void;
  addCustomItem: (input: CustomItemInput) => void;
  addProductToDraft: (productId: string, quantity?: number) => void;
  setDraftDiscount: (type: DiscountType, value: number) => void;
  setDraftCustomer: (name: string) => void;
  clearDraft: () => void;

  finalizeBill: () => { ok: true; bill: Bill } | { ok: false; error: string };
  deleteBill: (id: string) => void;
  importData: (payload: { products: Product[]; bills: Bill[]; settings: Settings }) => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const initialData: AppData = {
  products: [],
  bills: [],
  settings: { ...DEFAULT_SETTINGS },
  draft: emptyDraft(),
};

function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1_000_000, Math.round(value * 1000) / 1000);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clearTick, setClearTick] = useState(0);
  const storageRef = useRef<StorageLike | null>(null);
  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

  useEffect(() => {
    const storage = getBrowserStorage();
    storageRef.current = storage;
    setStorageAvailable(Boolean(storage));
    const loaded = loadAppData(storage);
    setData(loaded);
    setHydrated(true);
  }, []);

  // Persist each slice independently so one failure never loses another.
  useEffect(() => {
    if (!hydrated) return;
    const result = saveProducts(storageRef.current, data.products);
    if (!result.ok && result.error) setSaveError(result.error);
  }, [data.products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveBills(storageRef.current, data.bills);
    if (!result.ok && result.error) setSaveError(result.error);
  }, [data.bills, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveSettings(storageRef.current, data.settings);
    if (!result.ok && result.error) setSaveError(result.error);
  }, [data.settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveDraft(storageRef.current, data.draft);
    if (!result.ok && result.error) setSaveError(result.error);
  }, [data.draft, hydrated]);

  // Runs after the persistence effects above, so a reset leaves storage empty
  // instead of re-writing the freshly-defaulted, empty slices.
  useEffect(() => {
    if (!clearTick) return;
    clearLocalData(storageRef.current);
  }, [clearTick]);

  const addProduct = useCallback<AppContextValue["addProduct"]>((values) => {
    const current = dataRef.current;
    const errors = validateProductInput(values, current.products);
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    const product = productFromInput(values);
    setData((prev) => ({ ...prev, products: [product, ...prev.products] }));
    return { ok: true, product };
  }, []);

  const updateProduct = useCallback<AppContextValue["updateProduct"]>((id, values) => {
    const current = dataRef.current;
    const existing = current.products.find((product) => product.id === id);
    if (!existing) return { ok: false, errors: { name: "This product no longer exists." } };
    const errors = validateProductInput(values, current.products, id);
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    const updated = productFromInput(values, existing);
    setData((prev) => ({
      ...prev,
      products: prev.products.map((product) => (product.id === id ? updated : product)),
      draft: {
        ...prev.draft,
        items: prev.draft.items.map((item) =>
          item.productId === id
            ? { ...item, name: updated.name, unit: updated.unit, unitPrice: updated.price }
            : item,
        ),
      },
    }));
    return { ok: true, product: updated };
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData((prev) => {
      const remaining = prev.products.filter((product) => product.id !== id);
      return {
        ...prev,
        products: remaining,
        draft: {
          ...prev.draft,
          items: prev.draft.items.map((item) => syncItemWithProduct(item, remaining)),
        },
      };
    });
  }, []);

  const addSampleProducts = useCallback(() => {
    const current = dataRef.current;
    const existingNames = new Set(current.products.map((product) => product.name.toLowerCase()));
    const additions = createSampleProducts().filter(
      (sample) => !existingNames.has(sample.name.toLowerCase()),
    );
    if (additions.length > 0) {
      setData((prev) => ({ ...prev, products: [...additions, ...prev.products] }));
    }
    return additions.length;
  }, []);

  const removeSampleProducts = useCallback(() => {
    const current = dataRef.current;
    const removed = current.products.filter((product) => product.isSample).length;
    if (removed === 0) return 0;
    const remaining = current.products.filter((product) => !product.isSample);
    setData((prev) => ({
      ...prev,
      products: remaining,
      draft: {
        ...prev.draft,
        items: prev.draft.items.map((item) => syncItemWithProduct(item, remaining)),
      },
    }));
    return removed;
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const completeSetup = useCallback<AppContextValue["completeSetup"]>((input) => {
    const current = dataRef.current;
    const existingNames = new Set(current.products.map((product) => product.name.toLowerCase()));
    const additions = input.includeSamples
      ? createSampleProducts().filter((sample) => !existingNames.has(sample.name.toLowerCase()))
      : [];
    setData((prev) => ({
      ...prev,
      products: [...additions, ...prev.products],
      settings: {
        ...prev.settings,
        shopName: input.shopName.trim() || DEFAULT_SETTINGS.shopName,
        address: input.address.trim(),
        phone: input.phone.trim(),
        language: input.language ?? prev.settings.language,
        receiptWidth: input.receiptWidth ?? prev.settings.receiptWidth,
        setupComplete: true,
      },
    }));
  }, []);

  const addDraftItems = useCallback((items: DraftItem[]) => {
    if (items.length === 0) return;
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: [...prev.draft.items, ...items],
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const updateDraftItem = useCallback((id: string, patch: Partial<DraftItem>) => {
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: prev.draft.items.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...patch };
          if (patch.quantity !== undefined) next.quantity = roundQuantity(patch.quantity);
          if (patch.unitPrice !== undefined) next.unitPrice = Math.max(0, roundMoney(patch.unitPrice));
          if (patch.unit !== undefined && !isUnit(patch.unit)) next.unit = item.unit;
          return next;
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const removeDraftItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: prev.draft.items.filter((item) => item.id !== id),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const resolveDraftItem = useCallback((id: string, productId: string) => {
    const product = dataRef.current.products.find((candidate) => candidate.id === productId);
    if (!product) return;
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: prev.draft.items.map((item) =>
          item.id === id ? applyProductToItem(item, product) : item,
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const customiseDraftItem = useCallback((id: string, price: number) => {
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: prev.draft.items.map((item) =>
          item.id === id ? markItemAsCustom(item, price) : item,
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const addCustomItem = useCallback<AppContextValue["addCustomItem"]>((input) => {
    const item: DraftItem = {
      id: createId("item"),
      productId: null,
      name: input.name.trim() || "Custom item",
      quantity: Math.max(0.001, roundQuantity(input.quantity || 1)),
      unit: isUnit(input.unit) ? input.unit : "piece",
      unitPrice: Math.max(0, roundMoney(input.price)),
      source: "custom",
      matchStatus: "custom",
      alternatives: [],
      needsReview: false,
      notice: "Custom item (not in catalogue)",
    };
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: [...prev.draft.items, item],
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const addProductToDraft = useCallback((productId: string, quantity = 1) => {
    const product = dataRef.current.products.find((candidate) => candidate.id === productId);
    if (!product) return;
    const item: DraftItem = {
      id: createId("item"),
      productId: product.id,
      name: product.name,
      quantity: Math.max(0.001, roundQuantity(quantity || 1)),
      unit: product.unit,
      unitPrice: product.price,
      source: "manual",
      matchStatus: "matched",
      alternatives: [],
      needsReview: false,
    };
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        items: [...prev.draft.items, item],
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const setDraftDiscount = useCallback((type: DiscountType, value: number) => {
    setData((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        discountType: type,
        discountValue:
          type === "percent" ? Math.min(100, Math.max(0, value)) : Math.max(0, value),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const setDraftCustomer = useCallback((name: string) => {
    setData((prev) => ({
      ...prev,
      draft: { ...prev.draft, customerName: name.slice(0, 80) },
    }));
  }, []);

  const clearDraft = useCallback(() => {
    setData((prev) => ({ ...prev, draft: emptyDraft() }));
  }, []);

  const finalizeBill = useCallback<AppContextValue["finalizeBill"]>(() => {
    const current = dataRef.current;
    const validation = validateDraft(current.draft, current.products);
    if (!validation.canFinalize) {
      return { ok: false, error: validation.issues[0]?.message ?? "Complete the bill first." };
    }
    const sequence = nextBillSequence(current.bills, current.settings.billSequence);
    const bill = createBill({
      draft: current.draft,
      products: current.products,
      settings: current.settings,
      sequence,
    });
    setData((prev) => ({
      ...prev,
      bills: [bill, ...prev.bills],
      draft: emptyDraft(),
      settings: { ...prev.settings, billSequence: sequence },
    }));
    return { ok: true, bill };
  }, []);

  const deleteBill = useCallback((id: string) => {
    setData((prev) => ({ ...prev, bills: prev.bills.filter((bill) => bill.id !== id) }));
  }, []);

  const importData = useCallback<AppContextValue["importData"]>((payload) => {
    setData((prev) => ({
      ...prev,
      products: payload.products,
      bills: [...payload.bills].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      settings: { ...payload.settings, setupComplete: true },
    }));
  }, []);

  const resetAllData = useCallback(() => {
    setData({
      products: [],
      bills: [],
      settings: { ...DEFAULT_SETTINGS },
      draft: emptyDraft(),
    });
    setClearTick((tick) => tick + 1);
  }, []);

  const draftTotals = useMemo(() => totalsForDraft(data.draft), [data.draft]);
  const draftValidation = useMemo(
    () => validateDraft(data.draft, data.products),
    [data.draft, data.products],
  );
  const todaySummary = useMemo(() => summarizeToday(data.bills), [data.bills]);

  const value = useMemo<AppContextValue>(
    () => ({
      hydrated,
      storageAvailable,
      saveError,
      products: data.products,
      bills: data.bills,
      settings: data.settings,
      draft: data.draft,
      draftTotals,
      draftValidation,
      todaySummary,
      addProduct,
      updateProduct,
      deleteProduct,
      addSampleProducts,
      removeSampleProducts,
      updateSettings,
      completeSetup,
      addDraftItems,
      updateDraftItem,
      removeDraftItem,
      resolveDraftItem,
      customiseDraftItem,
      addCustomItem,
      addProductToDraft,
      setDraftDiscount,
      setDraftCustomer,
      clearDraft,
      finalizeBill,
      deleteBill,
      importData,
      resetAllData,
    }),
    [
      hydrated,
      storageAvailable,
      saveError,
      data,
      draftTotals,
      draftValidation,
      todaySummary,
      addProduct,
      updateProduct,
      deleteProduct,
      addSampleProducts,
      removeSampleProducts,
      updateSettings,
      completeSetup,
      addDraftItems,
      updateDraftItem,
      removeDraftItem,
      resolveDraftItem,
      customiseDraftItem,
      addCustomItem,
      addProductToDraft,
      setDraftDiscount,
      setDraftCustomer,
      clearDraft,
      finalizeBill,
      deleteBill,
      importData,
      resetAllData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
