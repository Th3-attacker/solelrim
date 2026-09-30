"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { CheckCircle, MagnifyingGlass, Package, ShoppingCart } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CartPanel, type CartLine, type PaymentMethod } from "@/components/pos/cart-panel";
import { VariantPickerDialog } from "@/components/pos/variant-picker-dialog";
import { createPosSale } from "@/lib/actions/pos";
import { formatPrice } from "@/lib/format/currency";
import { matchesSearch } from "@/lib/shop/search-text";
import type { PosProduct, PosWallet } from "@/lib/queries/pos";

// Two columns (catalog + cart side by side) only from 1024px: below that,
// with the admin sidebar open, a portrait tablet can't fit both, so the
// cart moves into a bottom sheet instead.
const WIDE_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

type CompletedSale = { reference: string; total: number; change?: number };

const KNOWN_ERRORS = new Set(["invalid", "insufficientStock", "insufficientAmount"]);

export function CheckoutScreen({
  products,
  wallets,
}: {
  products: PosProduct[];
  wallets: PosWallet[];
}) {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");
  const currency = tCommon("currency");
  const router = useRouter();
  const isWide = useIsWide();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<PosProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);

  const visibleProducts = useMemo(() => {
    if (!query.trim()) return products;
    return products.filter((product) =>
      matchesSearch(
        `${product.name} ${product.category} ${product.variants.map((v) => v.sku).join(" ")}`,
        query,
      ),
    );
  }, [products, query]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // Display only — the server recomputes and clamps the same way.
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - discountValue;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const received = amountReceived.trim() ? Number(amountReceived) : null;
  const canCharge =
    cart.length > 0 &&
    !pending &&
    (paymentMethod === "cash"
      ? received === null || received >= total
      : walletAccountId !== null);

  function quantityInCart(variantId: string) {
    return cart.find((line) => line.variantId === variantId)?.quantity ?? 0;
  }

  function addVariant(product: PosProduct, variant: PosProduct["variants"][number]) {
    setCart((prev) => {
      const existing = prev.find((line) => line.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) return prev;
        return prev.map((line) =>
          line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          unitPrice: variant.price,
          quantity: 1,
          stock: variant.stock,
        },
      ];
    });
  }

  function handleProductClick(product: PosProduct) {
    if (product.variants.length === 1) {
      addVariant(product, product.variants[0]);
      return;
    }
    setPicking(product);
  }

  function handleQuantityChange(variantId: string, quantity: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.variantId === variantId
          ? { ...line, quantity: Math.min(Math.max(quantity, 1), line.stock) }
          : line,
      ),
    );
  }

  function handleRemove(variantId: string) {
    setCart((prev) => prev.filter((line) => line.variantId !== variantId));
  }

  function resetSale() {
    setCart([]);
    setDiscount("");
    setAmountReceived("");
    setWalletAccountId(null);
    setPaymentMethod("cash");
  }

  function handleCharge() {
    const items = cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
    startTransition(async () => {
      const result = await createPosSale(
        paymentMethod === "cash"
          ? { paymentMethod: "cash", items, discount: discountValue, amountReceived: received }
          : { paymentMethod: "wallet", items, discount: discountValue, walletAccountId },
      );
      if (result.error) {
        toast.error(
          KNOWN_ERRORS.has(result.error) ? t(`error.${result.error}`) : tCommon("error"),
        );
        // Someone else may have just sold the last unit — pull fresh stock.
        if (result.error === "insufficientStock") router.refresh();
        return;
      }
      setCompleted({
        reference: result.reference!,
        total: result.total!,
        change: result.change,
      });
      resetSale();
      setCartOpen(false);
      router.refresh();
    });
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      wallets={wallets}
      subtotal={subtotal}
      discountValue={discountValue}
      total={total}
      discount={discount}
      onDiscountChange={setDiscount}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      amountReceived={amountReceived}
      onAmountReceivedChange={setAmountReceived}
      walletAccountId={walletAccountId}
      onWalletAccountChange={setWalletAccountId}
      onQuantityChange={handleQuantityChange}
      onRemove={handleRemove}
      canCharge={canCharge}
      pending={pending}
      onCharge={handleCharge}
    />
  );

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-0">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="relative">
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="ps-9"
            />
          </div>

          {products.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("noProducts")}
            </p>
          ) : visibleProducts.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("noResults", { query })}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const inStock = product.variants.some(
                  (v) => v.stock - quantityInCart(v.id) > 0,
                );
                const prices = product.variants.map((v) => v.price);
                const minPrice = Math.min(...prices);
                const variesInPrice = minPrice !== Math.max(...prices);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={!inStock}
                      onClick={() => handleProductClick(product)}
                      className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-start transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="relative flex aspect-square w-full items-center justify-center bg-muted">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <Package aria-hidden="true" className="size-8 text-muted-foreground" />
                        )}
                        {!inStock && (
                          <span className="absolute inset-x-0 bottom-0 bg-background/90 py-1 text-center text-xs font-medium">
                            {t("outOfStock")}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5 p-2">
                        <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                        <span className="mt-auto text-sm font-semibold tabular-nums">
                          {variesInPrice
                            ? t("fromPrice", { price: formatPrice(minPrice, currency) })
                            : formatPrice(minPrice, currency)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isWide && (
          <aside className="self-start rounded-lg border p-4 lg:sticky lg:top-4">
            {cartPanel}
          </aside>
        )}
      </div>

      {!isWide && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="size-5" />
              {t("viewCart", { count: itemCount, total: formatPrice(total, currency) })}
            </Button>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("cart")}</SheetTitle>
              </SheetHeader>
              <div className="p-4">{cartPanel}</div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <VariantPickerDialog
        product={picking}
        quantityInCart={quantityInCart}
        onPick={(product, variant) => {
          addVariant(product, variant);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />

      <Dialog open={completed !== null} onOpenChange={(open) => !open && setCompleted(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <CheckCircle aria-hidden="true" className="size-10 text-primary" />
            <DialogTitle>{t("saleRecorded")}</DialogTitle>
          </DialogHeader>
          {completed && (
            <dl className="flex flex-col gap-2 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("reference")}</dt>
                <dd className="font-mono font-medium">{completed.reference}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>{t("total")}</dt>
                <dd>{formatPrice(completed.total, currency)}</dd>
              </div>
              {completed.change !== undefined && (
                <div className="flex justify-between rounded-md bg-muted p-2 font-medium">
                  <dt>{t("change")}</dt>
                  <dd>{formatPrice(completed.change, currency)}</dd>
                </div>
              )}
            </dl>
          )}
          <DialogFooter>
            <Button type="button" className="w-full" onClick={() => setCompleted(null)}>
              {t("newSale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
