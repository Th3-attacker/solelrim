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

const STORAGE_KEY = "solelrim-favorites";

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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ids: [], hydrated: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      dispatch({ type: "HYDRATE", ids: Array.isArray(ids) ? ids : [] });
    } catch {
      dispatch({ type: "HYDRATE", ids: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
  }, [state.ids, state.hydrated]);

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
