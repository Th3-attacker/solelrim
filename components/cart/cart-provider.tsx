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
  | { type: "CLEAR" };

const STORAGE_KEY = "solelrim-cart";

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
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartLine[];
  hydrated: boolean;
  addItem: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    hydrated: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const items = raw ? (JSON.parse(raw) as CartLine[]) : [];
      dispatch({ type: "HYDRATE", items: Array.isArray(items) ? items : [] });
    } catch {
      dispatch({ type: "HYDRATE", items: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items, state.hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = state.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    return {
      items: state.items,
      hydrated: state.hydrated,
      addItem: (line, quantity = 1) =>
        dispatch({ type: "ADD_ITEM", line, quantity }),
      updateQuantity: (variantId, quantity) =>
        dispatch({ type: "UPDATE_QUANTITY", variantId, quantity }),
      removeItem: (variantId) => dispatch({ type: "REMOVE_ITEM", variantId }),
      clear: () => dispatch({ type: "CLEAR" }),
      itemCount,
      subtotal,
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
