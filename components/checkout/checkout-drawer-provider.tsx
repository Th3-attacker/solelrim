"use client";

import { createContext, useContext, useMemo, useState } from "react";

type CheckoutDrawerContextValue = {
  open: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
};

const CheckoutDrawerContext = createContext<CheckoutDrawerContextValue | null>(
  null,
);

export function CheckoutDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const value = useMemo<CheckoutDrawerContextValue>(
    () => ({
      open,
      openCheckout: () => setOpen(true),
      closeCheckout: () => setOpen(false),
    }),
    [open],
  );

  return (
    <CheckoutDrawerContext.Provider value={value}>
      {children}
    </CheckoutDrawerContext.Provider>
  );
}

export function useCheckoutDrawer() {
  const ctx = useContext(CheckoutDrawerContext);
  if (!ctx) {
    throw new Error(
      "useCheckoutDrawer must be used within a CheckoutDrawerProvider",
    );
  }
  return ctx;
}
