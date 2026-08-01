"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

type FavoritesState = { ids: string[]; hydrated: boolean };

type FavoritesAction =
  | { type: "HYDRATE"; ids: string[] }
  | { type: "TOGGLE"; id: string };

function reducer(state: FavoritesState, action: FavoritesAction): FavoritesState {
  switch (action.type) {
    case "HYDRATE":
      return { ids: action.ids, hydrated: true };
    case "TOGGLE":
      return {
        ...state,
        ids: state.ids.includes(action.id)
          ? state.ids.filter((id) => id !== action.id)
          : [...state.ids, action.id],
      };
    default:
      return state;
  }
}

type FavoritesContextValue = {
  ids: string[];
  hydrated: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({
  storeType,
  children,
}: {
  storeType: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, { ids: [], hydrated: false });
  const storageKey = `solelrim-favorites-${storeType}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      dispatch({ type: "HYDRATE", ids: Array.isArray(ids) ? ids : [] });
    } catch {
      dispatch({ type: "HYDRATE", ids: [] });
    }
    // Re-hydrates on a client-side navigation between two boutiques too,
    // since this provider isn't guaranteed to remount when storeType
    // changes (its parent layout re-renders in place).
  }, [storageKey]);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(state.ids));
  }, [storageKey, state.ids, state.hydrated]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids: state.ids,
      hydrated: state.hydrated,
      isFavorite: (id) => state.ids.includes(id),
      toggleFavorite: (id) => dispatch({ type: "TOGGLE", id }),
    }),
    [state],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
