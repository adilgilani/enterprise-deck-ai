// Tiny client store for brand systems, templates, brand assets and generated content.
// Mutations happen in event handlers only (never during SSR). State is persisted to
// localStorage so the generated library and brand logos survive reloads.
// Swap for React Query + API calls when the backend exists.
import { useSyncExternalStore } from "react";
import {
  seedBrandAssets,
  seedBrands,
  seedDocTemplates,
  type BrandAsset,
  type BrandLogos,
  type BrandSystem,
  type DocTemplate,
} from "@/lib/brand-data";
import { seedGenerated, type GeneratedItem } from "@/lib/generated-data";

interface State {
  brands: BrandSystem[];
  activeBrandId: string;
  docTemplates: DocTemplate[];
  brandAssets: BrandAsset[];
  generated: GeneratedItem[];
}

// v2: Stixor brand rebuilt from its official guidelines + presentation template.
const KEY = "eapi.store.v2";
const initial: State = {
  brands: seedBrands,
  activeBrandId: "stixor",
  docTemplates: seedDocTemplates,
  brandAssets: seedBrandAssets,
  generated: seedGenerated,
};

function load(): State {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw) as Partial<State>;
    return { ...initial, ...saved };
  } catch {
    return initial;
  }
}

let state = load();
const listeners = new Set<() => void>();
let warned = false;

function set(fn: (s: State) => State) {
  state = fn(state);
  listeners.forEach((l) => l());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    if (!warned) console.warn("Could not persist workspace state (storage full or blocked).", e);
    warned = true;
  }
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
/** Selectors must return stable references (raw slices or items found in them). */
function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => sel(state),
    () => sel(initial),
  );
}

const noop = () => () => {};
/** False during SSR and hydration, true afterwards — gate UI that needs persisted state. */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export const useBrands = () => useStore((s) => s.brands);
export const useBrand = (id: string | undefined) =>
  useStore((s) => s.brands.find((b) => b.id === id));
export const useActiveBrand = () =>
  useStore((s) => s.brands.find((b) => b.id === s.activeBrandId) ?? s.brands[0]!);
export const useDocTemplates = () => useStore((s) => s.docTemplates);
export const useBrandAssets = () => useStore((s) => s.brandAssets);
export const useGeneratedList = () => useStore((s) => s.generated);
export const useGenerated = (id: string) => useStore((s) => s.generated.find((g) => g.id === id));

export const actions = {
  setActiveBrand: (id: string) => set((s) => ({ ...s, activeBrandId: id })),
  updateBrand: (id: string, patch: Partial<BrandSystem>) =>
    set((s) => ({
      ...s,
      brands: s.brands.map((b) => (b.id === id ? { ...b, ...patch, updated: "Just now" } : b)),
    })),
  setLogo: (id: string, slot: keyof BrandLogos, dataUrl: string | undefined) =>
    set((s) => ({
      ...s,
      brands: s.brands.map((b) => {
        if (b.id !== id) return b;
        const logos = { ...b.logos };
        if (dataUrl) logos[slot] = dataUrl;
        else delete logos[slot];
        return { ...b, logos, updated: "Just now" };
      }),
    })),
  addBrand: (b: BrandSystem) => set((s) => ({ ...s, brands: [...s.brands, b] })),
  addTemplate: (t: DocTemplate) => set((s) => ({ ...s, docTemplates: [t, ...s.docTemplates] })),
  updateTemplate: (id: string, patch: Partial<DocTemplate>) =>
    set((s) => ({
      ...s,
      docTemplates: s.docTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  addAssets: (a: BrandAsset[]) => set((s) => ({ ...s, brandAssets: [...a, ...s.brandAssets] })),
  addGenerated: (g: GeneratedItem) => set((s) => ({ ...s, generated: [g, ...s.generated] })),
  updateGenerated: (id: string, patch: Partial<GeneratedItem>) =>
    set((s) => ({
      ...s,
      generated: s.generated.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),
  removeGenerated: (id: string) =>
    set((s) => ({ ...s, generated: s.generated.filter((g) => g.id !== id) })),
};
