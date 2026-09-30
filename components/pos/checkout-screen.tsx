"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle,
  MagnifyingGlass,
  Package,
  Receipt,
  ShoppingCart,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
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
import { LoyaltyCardPicker } from "@/components/pos/loyalty-card-picker";
import { useMediaQuery } from "@/hooks/use-media-query";
import { createPosSale } from "@/lib/actions/pos";
import { lookupLoyaltyCard, type LoyaltyCard } from "@/lib/actions/loyalty";
import { formatPrice } from "@/lib/format/currency";
import { matchesSearch } from "@/lib/shop/search-text";
import type { PosLoyaltyRule, PosProduct, PosWallet } from "@/lib/queries/pos";

// Two columns (catalog + cart side by side) only from 1024px: below that,
// with the admin sidebar open, a portrait tablet can't fit both, so the
// cart moves into a bottom sheet instead.
const WIDE_QUERY = "(min-width: 1024px)";

// What the cart remembers about a line. Name/size/color are kept only to
// label a line whose variant has since vanished from the catalog — price
// and stock are always read fresh from `products` (see `lines` below).
type CartEntry = {
  variantId: string;
  quantity: number;
  productName: string;
  size: string;
  color: string;
  lastPrice: number;
};

type CompletedSale = {
  saleId: string;
  reference: string;
  total: number;
  change?: number;
  pointsEarned?: number;
  pointsBalance?: number | null;
};

const KNOWN_ERRORS = new Set([
  "invalid",
  "insufficientStock",
  "insufficientAmount",
  "insufficientPoints",
  "totalChanged",
  "unauthorized",
  "licenseBlocked",
]);

export function CheckoutScreen({
  products,
  wallets,
  loyaltyRule,
}: {
  products: PosProduct[];
  wallets: PosWallet[];
  loyaltyRule: PosLoyaltyRule;
}) {
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");
  const currency = tCommon("currency");
  const router = useRouter();
  const isWide = useMediaQuery(WIDE_QUERY);
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [redeem, setRedeem] = useState(false);
  // Content and open state are kept apart so a dialog keeps showing its
  // content through its close animation instead of collapsing empty.
  const [picking, setPicking] = useState<PosProduct | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const variantIndex = useMemo(() => {
    const index = new Map<string, PosProduct["variants"][number]>();
    for (const product of products) {
      for (const variant of product.variants) index.set(variant.id, variant);
    }
    return index;
  }, [products]);

  // Re-derived from the latest catalog on every render — after any refresh
  // (another sale, an online order, a price edit) the cart shows the real
  // stock and price, so a retry doesn't fail on the same stale numbers.
  const lines: CartLine[] = entries.map((entry) => {
    const variant = variantIndex.get(entry.variantId);
    const stock = variant?.stock ?? 0;
    return {
      variantId: entry.variantId,
      productName: entry.productName,
      size: entry.size,
      color: entry.color,
      unitPrice: variant?.price ?? entry.lastPrice,
      quantity: Math.min(entry.quantity, Math.max(stock, 1)),
      stock,
      unavailable: stock === 0,
    };
  });
  const sellableLines = lines.filter((line) => !line.unavailable);

  const visibleProducts = useMemo(() => {
    if (!query.trim()) return products;
    return products.filter((product) =>
      matchesSearch(
        `${product.name} ${product.category} ${product.variants.map((v) => v.sku).join(" ")}`,
        query,
      ),
    );
  }, [products, query]);

  const subtotal = sellableLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // Display only — the server recomputes and clamps the same way, and
  // refuses the sale if its total differs from this one (totalChanged).
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  // Same rule recordSale applies server-side: a reward never discounts
  // below zero, and only a card holding enough points can use one.
  // Mirrors recordSale: no reward is spent when there's nothing to discount.
  const rewardApplicable = subtotal - discountValue > 0;
  const redeeming =
    redeem &&
    rewardApplicable &&
    loyaltyCard !== null &&
    loyaltyCard.points >= loyaltyRule.rewardPoints;
  const loyaltyDiscountValue = redeeming
    ? Math.min(loyaltyRule.rewardValue, subtotal - discountValue)
    : 0;
  const total = subtotal - discountValue - loyaltyDiscountValue;
  const pointsPreview = loyaltyCard ? Math.floor(total / loyaltyRule.spendPerPoint) : null;
  const itemCount = sellableLines.reduce((sum, line) => sum + line.quantity, 0);

  const received = amountReceived.trim() ? Number(amountReceived) : null;
  const canCharge =
    sellableLines.length > 0 &&
    // A sold-out line must be removed first, so what's charged is exactly
    // what the cart shows.
    sellableLines.length === lines.length &&
    !pending &&
    (paymentMethod === "cash"
      ? received === null || received >= total
      : walletAccountId !== null);

  function quantityInCart(variantId: string) {
    return lines.find((line) => line.variantId === variantId)?.quantity ?? 0;
  }

  function addVariant(product: PosProduct, variant: PosProduct["variants"][number]) {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) return prev;
        return prev.map((entry) =>
          entry.variantId === variant.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          quantity: 1,
          productName: product.name,
          size: variant.size,
          color: variant.color,
          lastPrice: variant.price,
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
    setPickerOpen(true);
  }

  function handleQuantityChange(variantId: string, quantity: number) {
    const stock = variantIndex.get(variantId)?.stock ?? 0;
    setEntries((prev) =>
      prev.map((entry) =>
        entry.variantId === variantId
          ? { ...entry, quantity: Math.min(Math.max(quantity, 1), Math.max(stock, 1)) }
          : entry,
      ),
    );
  }

  function handleRemove(variantId: string) {
    setEntries((prev) => prev.filter((entry) => entry.variantId !== variantId));
  }

  function resetSale() {
    setEntries([]);
    setDiscount("");
    setAmountReceived("");
    setWalletAccountId(null);
    setPaymentMethod("cash");
    setLoyaltyCard(null);
    setRedeem(false);
  }

  // The reward was refused because the card's balance moved (spent at
  // another counter): reload the card so the screen shows its real points.
  async function refreshLoyaltyCard(card: LoyaltyCard) {
    const result = await lookupLoyaltyCard(card.phone);
    setRedeem(false);
    setLoyaltyCard(result.card ?? null);
  }

  function handleCharge() {
    const items = sellableLines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
    }));
    const base = {
      items,
      discount: discountValue,
      expectedTotal: total,
      loyalty: loyaltyCard ? { clientId: loyaltyCard.clientId, redeem: redeeming } : null,
    };
    const cardAtCharge = loyaltyCard;
    startTransition(async () => {
      // Every failure path keeps the cart intact: a thrown action would
      // otherwise reach the error boundary and wipe the whole sale.
      try {
        const result = await createPosSale(
          paymentMethod === "cash"
            ? { ...base, paymentMethod: "cash", amountReceived: received }
            : { ...base, paymentMethod: "wallet", walletAccountId },
        );
        if (result.error) {
          toast.error(
            KNOWN_ERRORS.has(result.error) ? t(`error.${result.error}`) : tCommon("error"),
          );
          // Stock, prices or wallet accounts may have moved under us — pull
          // the current catalog so the cart re-derives against it.
          router.refresh();
          if (result.error === "insufficientPoints" && cardAtCharge) {
            await refreshLoyaltyCard(cardAtCharge);
          }
          return;
        }
        setCompleted({
          saleId: result.saleId!,
          reference: result.reference!,
          total: result.total!,
          change: result.change,
          pointsEarned: cardAtCharge ? result.loyaltyPointsEarned : undefined,
          pointsBalance: result.loyaltyPointsBalance,
        });
        setCompletedOpen(true);
        resetSale();
        setCartOpen(false);
        // No router.refresh() here: createPosSale's revalidatePath already
        // re-renders this route with the updated stock.
      } catch {
        toast.error(tCommon("error"));
        router.refresh();
      }
    });
  }

  const cartPanel = (
    <CartPanel
      cart={lines}
      wallets={wallets}
      subtotal={subtotal}
      discountValue={discountValue}
      loyaltyDiscountValue={loyaltyDiscountValue}
      pointsPreview={pointsPreview}
      loyaltySlot={
        loyaltyRule.enabled ? (
          <LoyaltyCardPicker
            rule={loyaltyRule}
            card={loyaltyCard}
            redeem={redeem}
            rewardApplicable={rewardApplicable}
            onCardChange={setLoyaltyCard}
            onRedeemChange={setRedeem}
          />
        ) : undefined
      }
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

        {/* isWide is null until the browser has answered, so neither cart
            variant renders on the server — the catalog column keeps its
            width either way and nothing visibly swaps layouts. */}
        {isWide === true && (
          <aside className="self-start rounded-lg border p-4 lg:sticky lg:top-4">
            {cartPanel}
          </aside>
        )}
      </div>

      {isWide === false && (
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
        open={pickerOpen}
        quantityInCart={quantityInCart}
        onPick={(product, variant) => {
          addVariant(product, variant);
          setPickerOpen(false);
        }}
        onOpenChange={setPickerOpen}
      />

      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
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
              {completed.pointsEarned !== undefined && (
                <div className="flex justify-between text-primary">
                  <dt>{t("loyaltyPointsEarned")}</dt>
                  <dd>
                    +{completed.pointsEarned} ·{" "}
                    {t("loyaltyBalance", { points: completed.pointsBalance ?? 0 })}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {completed && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/pos/receipt/${completed.saleId}`}>
                  <Receipt className="size-4" />
                  {t("receipt")}
                </Link>
              </Button>
            )}
            <Button type="button" className="w-full" onClick={() => setCompletedOpen(false)}>
              {t("newSale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
