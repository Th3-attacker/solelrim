"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

export type CartLine = {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  imageStoragePath: string | null;
  stock: number;
  quantity: number;
};

type CartState = { items: CartLine[]; hydrated: boolean };

type CartAction =
  | { type: "HYDRATE"; items: CartLine[] }
  | { type: "ADD_ITEM"; line: Omit<CartLine, "quantity">; quantity: number }
  | { type: "UPDATE_QUANTITY"; variantId: string; quantity: number }
  | { type: "REMOVE_ITEM"; variantId: string }
  | { type: "SYNC_STOCK"; stockByVariantId: Record<string, number> }
  | { type: "CLEAR" };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items, hydrated: true };
    case "ADD_ITEM": {
      const existing = state.items.find(
        (i) => i.variantId === action.line.variantId,
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.variantId === action.line.variantId
              ? {
                  ...i,
                  quantity: Math.min(
                    i.quantity + action.quantity,
                    action.line.stock,
                  ),
                }
              : i,
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            ...action.line,
            quantity: Math.min(action.quantity, action.line.stock),
          },
        ],
      };
    }
    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.variantId !== action.variantId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.variantId === action.variantId
            ? { ...i, quantity: Math.min(action.quantity, i.stock) }
            : i,
        ),
      };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.variantId !== action.variantId),
      };
    case "SYNC_STOCK": {
      // Reconciles the cached stock snapshot against the real, current
      // values: clamps quantity down if it now exceeds live stock, and
      // drops the line entirely once live stock hits 0. A variant absent
      // from the map (deleted, or moved to another boutique) is treated
      // the same as 0 in stock — never trusted to mean "unlimited".
      return {
        ...state,
        items: state.items
          .map((i) => {
            const liveStock = action.stockByVariantId[i.variantId] ?? 0;
            return { ...i, stock: liveStock, quantity: Math.min(i.quantity, liveStock) };
          })
          .filter((i) => i.quantity > 0),
      };
    }
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  storeType: string;
  items: CartLine[];
  hydrated: boolean;
  addItem: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  syncStock: (stockByVariantId: Record<string, number>) => void;
  clear: () => void;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  storeType,
  children,
}: {
  storeType: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    hydrated: false,
  });
  const storageKey = `solelrim-cart-${storeType}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const items = raw ? (JSON.parse(raw) as CartLine[]) : [];
      dispatch({ type: "HYDRATE", items: Array.isArray(items) ? items : [] });
    } catch {
      dispatch({ type: "HYDRATE", items: [] });
    }
    // Re-hydrates from the new boutique's own key on the (rare) client-side
    // navigation between two boutiques too, not just on first mount — this
    // provider isn't guaranteed to remount when storeType changes, since
    // its parent layout re-renders in place rather than unmounting.
  }, [storageKey]);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(state.items));
  }, [storageKey, state.items, state.hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = state.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    return {
      storeType,
      items: state.items,
      hydrated: state.hydrated,
      addItem: (line, quantity = 1) =>
        dispatch({ type: "ADD_ITEM", line, quantity }),
      updateQuantity: (variantId, quantity) =>
        dispatch({ type: "UPDATE_QUANTITY", variantId, quantity }),
      removeItem: (variantId) => dispatch({ type: "REMOVE_ITEM", variantId }),
      syncStock: (stockByVariantId) =>
        dispatch({ type: "SYNC_STOCK", stockByVariantId }),
      clear: () => dispatch({ type: "CLEAR" }),
      subtotal,
    };
  }, [state, storeType]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
