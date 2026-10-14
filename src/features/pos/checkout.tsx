import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import { cn } from "~/lib/cn";
import { Button, ButtonLink, IconButton } from "~/components/ui/button";
import { Dialog, Sheet } from "~/components/ui/dialog";
import { Field, Input } from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { notify } from "~/components/ui/toast";
import type { Locale } from "~/i18n/config";
import {
  addToCart,
  changeDue,
  computeTicket,
  setQuantity,
  type CartEntry,
  type CatalogVariant,
  type LoyaltyCard,
} from "./cart";
import { enrollLoyaltyCard, lookupLoyaltyCard, sell, type getCheckout } from "./pos.functions";
import { checkoutQuery } from "./pos.queries";
import { parseAmount, useMoney } from "./till-parts";
import { useCommandError } from "./use-command-error";

type OpenCheckout = Extract<Awaited<ReturnType<typeof getCheckout>>, { open: true }>;
type Product = OpenCheckout["products"][number];
type Payment = { method: "cash" } | { method: "wallet"; walletAccountId: string };
type CompletedSale = {
  saleId: string;
  reference: string;
  total: number;
  change?: number;
  points?: number;
};

// The checkout: the catalog on one side, the ticket on the other (in a
// sheet on phones). Everything is computed here for display; the server
// recomputes it and refuses the sale if anything moved (stock, a price).
export function Checkout({ data, locale }: { data: OpenCheckout; locale: Locale }) {
  const t = useTranslations("pos");
  const money = useMoney();
  const queryClient = useQueryClient();
  const showError = useCommandError("pos.error");

  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [discountText, setDiscountText] = useState("");
  const [payment, setPayment] = useState<Payment>({ method: "cash" });
  const [receivedText, setReceivedText] = useState("");
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [redeem, setRedeem] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [picking, setPicking] = useState<Product | null>(null);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);

  const variants = useMemo(() => {
    const index = new Map<string, CatalogVariant>();
    for (const product of data.products)
      for (const variant of product.variants) index.set(variant.id, variant);
    return index;
  }, [data.products]);

  const ticket = computeTicket({
    entries,
    variants,
    discount: parseAmount(discountText) ?? 0,
    loyaltyRule: data.loyaltyRule,
    card,
    redeem,
  });
  const received = payment.method === "cash" ? parseAmount(receivedText) : null;
  const change = changeDue(received, ticket.total);
  const canCharge = ticket.chargeable && (change === null || change >= 0);

  const add = (product: Product, variant: CatalogVariant) =>
    setEntries((cart) => addToCart(cart, product, variant));
  const choose = (product: Product) => {
    const available = product.variants.filter((variant) => variant.stock > 0);
    if (product.variants.length === 1 && available.length === 1) add(product, available[0]);
    else setPicking(product);
  };

  function reset() {
    setEntries([]);
    setDiscountText("");
    setReceivedText("");
    setPayment({ method: "cash" });
    setCard(null);
    setRedeem(false);
  }

  const charge = useMutation({
    mutationFn: async () => {
      const base = {
        items: ticket.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        discount: ticket.discount,
        expectedTotal: ticket.total,
        loyalty: card ? { clientId: card.clientId, redeem: ticket.redeeming } : null,
      };
      return sell({
        data:
          payment.method === "cash"
            ? { ...base, paymentMethod: "cash", amountReceived: received }
            : { ...base, paymentMethod: "wallet", walletAccountId: payment.walletAccountId },
      });
    },
    onSuccess: async (result) => {
      if (result.error) {
        showError(result.error);
        // Stock, prices or the card's points moved: read them again, the
        // ticket re-derives against the new figures and keeps its lines.
        await queryClient.invalidateQueries({ queryKey: checkoutQuery.queryKey });
        if (result.error === "insufficientPoints") setRedeem(false);
        return;
      }
      setCompleted({
        saleId: result.saleId!,
        reference: result.reference!,
        total: result.total!,
        change: result.change,
        points: card ? result.loyaltyPointsEarned : undefined,
      });
      reset();
      setTicketOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["till"] }),
        queryClient.invalidateQueries({ queryKey: ["orders", "dashboard"] }),
      ]);
    },
    onError: showError,
  });

  const ticketPanel = (
    <TicketPanel
      ticket={ticket}
      wallets={data.wallets}
      loyalty={
        data.loyaltyRule.enabled ? (
          <LoyaltyPicker
            rule={data.loyaltyRule}
            card={card}
            redeem={redeem}
            onCard={(next) => {
              setCard(next);
              if (!next) setRedeem(false);
            }}
            onRedeem={setRedeem}
          />
        ) : null
      }
      discountText={discountText}
      onDiscount={setDiscountText}
      payment={payment}
      onPayment={setPayment}
      receivedText={receivedText}
      onReceived={setReceivedText}
      change={change}
      onQuantity={(variantId, quantity) =>
        setEntries((cart) =>
          setQuantity(cart, variantId, quantity, variants.get(variantId)?.stock ?? 0),
        )
      }
      onClear={reset}
      charge={
        <Button
          variant="primary"
          className="h-14 w-full text-[17px] font-bold"
          disabled={!canCharge}
          busy={charge.isPending}
          onClick={() => charge.mutate()}
        >
          {t("charge", { total: money(ticket.total) })}
        </Button>
      }
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <Catalog products={data.products} inTicket={entries} onChoose={choose} onScan={add} />

      <aside
        aria-label={t("ticketTitle")}
        className="hidden border-s border-line bg-surface lg:flex lg:min-h-0 lg:w-[380px] lg:flex-none lg:flex-col"
      >
        {ticketPanel}
      </aside>

      {/* Phones and tablets: the ticket's total at thumb's reach, the ticket in a sheet. */}
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface px-4 py-2.5 md:bottom-0 lg:hidden">
        <Button
          variant="primary"
          className="h-14 w-full justify-between rounded-[14px] px-4"
          onClick={() => setTicketOpen(true)}
        >
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-white/20 px-1.5 text-[13px]">
            {ticket.itemCount}
          </span>
          <span className="flex-1 text-start text-[15px]">{t("viewTicket")}</span>
          <b className="text-[17px]">{money(ticket.total)}</b>
        </Button>
      </div>
      <Sheet
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        side="bottom"
        title={t("ticketTitle")}
        titleHidden
      >
        <div className="flex max-h-[88dvh] flex-col">{ticketPanel}</div>
      </Sheet>

      <VariantPicker
        product={picking}
        onClose={() => setPicking(null)}
        onPick={add}
        inTicket={entries}
      />

      <Dialog
        open={completed !== null}
        onOpenChange={(open) => !open && setCompleted(null)}
        title={t("saleRecorded")}
        closeLabel={t("newSale")}
        footer={
          completed && (
            <>
              <ButtonLink
                to="/$locale/admin/pos/receipt/$saleId"
                params={{ locale, saleId: completed.saleId }}
              >
                <Icon name="print" />
                {t("receipt")}
              </ButtonLink>
              <Button variant="primary" onClick={() => setCompleted(null)} autoFocus>
                {t("newSale")}
              </Button>
            </>
          )
        }
      >
        {completed && (
          <dl className="flex flex-col gap-2 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("reference")}</dt>
              <dd dir="ltr" className="font-semibold">
                {completed.reference}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("total")}</dt>
              <dd className="font-semibold">{money(completed.total)}</dd>
            </div>
            {completed.change !== undefined && completed.change > 0 && (
              <div className="flex justify-between gap-3 rounded-control bg-ok-bg px-3 py-2 text-ok-ink">
                <dt className="font-semibold">{t("change")}</dt>
                <dd className="text-[20px] font-bold">{money(completed.change)}</dd>
              </div>
            )}
            {completed.points !== undefined && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("loyaltyPointsEarned")}</dt>
                <dd className="font-semibold">{completed.points}</dd>
              </div>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}

// The catalog: search (a barcode scanner types the SKU and presses Enter),
// categories, and a tile per product.
function Catalog({
  products,
  inTicket,
  onChoose,
  onScan,
}: {
  products: Product[];
  inTicket: CartEntry[];
  onChoose: (product: Product) => void;
  onScan: (product: Product, variant: CatalogVariant) => void;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))],
    [products],
  );

  const needle = normalize(query.trim());
  const shown = products.filter(
    (product) =>
      (!category || product.category === category) &&
      (!needle ||
        normalize(
          `${product.name} ${product.category} ${product.variants.map((v) => v.sku ?? "").join(" ")}`,
        ).includes(needle)),
  );
  const countOf = (product: Product) =>
    inTicket
      .filter((entry) => product.variants.some((variant) => variant.id === entry.variantId))
      .reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <section
      aria-label={t("catalogLabel")}
      className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-5 pb-28 md:px-6 lg:overflow-y-auto lg:pb-6"
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          // A scanned code names one variant exactly: straight into the ticket.
          const code = query.trim().toLowerCase();
          for (const product of products) {
            const variant = product.variants.find((v) => v.sku?.toLowerCase() === code);
            if (variant) {
              onScan(product, variant);
              setQuery("");
              return;
            }
          }
          if (shown.length === 1) onChoose(shown[0]);
        }}
      >
        <Input
          type="search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<Icon name="search" className="text-muted" />}
          className="h-12 rounded-xl text-[15px]"
          autoFocus
        />
      </form>

      {categories.length > 1 && (
        <div
          role="group"
          aria-label={t("categoriesLabel")}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
        >
          {[null, ...categories].map((name) => (
            <button
              key={name ?? "all"}
              type="button"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
              className="h-9 flex-none rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink-2 aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-brand"
            >
              {name ?? t("allCategories")}
            </button>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <p className="py-10 text-center text-muted">{t("noProducts")}</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-muted">{t("noResults", { query })}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {shown.map((product) => {
            const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
            const prices = product.variants.map((variant) => variant.price);
            const min = Math.min(...prices);
            const count = countOf(product);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={stock === 0}
                  onClick={() => onChoose(product)}
                  aria-label={t("addToTicket", { name: product.name })}
                  className="group relative flex w-full flex-col overflow-hidden rounded-card border border-line bg-surface text-start hover:border-brand hover:shadow-[0_0_0_1px_var(--brand)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line disabled:hover:shadow-none"
                >
                  <span className="relative block aspect-[4/3] bg-tile sm:aspect-square">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    )}
                    {count > 0 && (
                      <span className="absolute end-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-on-brand">
                        {count}
                      </span>
                    )}
                    {stock === 0 && (
                      <span className="absolute start-2 top-2 rounded-full bg-bad-bg px-2 py-0.5 text-[11px] font-bold text-bad-ink">
                        {t("outOfStock")}
                      </span>
                    )}
                  </span>
                  <span className="block px-3 pt-2.5 pb-3">
                    <span className="block truncate text-[12px] text-muted">
                      {product.category}
                    </span>
                    <span className="block truncate text-[14px] font-semibold">{product.name}</span>
                    <span className="mt-0.5 block text-[14px] font-bold text-brand tabular-nums">
                      {min === Math.max(...prices)
                        ? money(min)
                        : t("fromPrice", { price: money(min) })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function VariantPicker({
  product,
  inTicket,
  onClose,
  onPick,
}: {
  product: Product | null;
  inTicket: CartEntry[];
  onClose: () => void;
  onPick: (product: Product, variant: CatalogVariant) => void;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={product?.name ?? ""}
      description={t("chooseVariant")}
      closeLabel={t("backToCheckout")}
    >
      {product && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {product.variants.map((variant) => {
            const taken = inTicket.find((entry) => entry.variantId === variant.id)?.quantity ?? 0;
            const left = variant.stock - taken;
            return (
              <li key={variant.id}>
                <button
                  type="button"
                  disabled={left <= 0}
                  onClick={() => {
                    onPick(product, variant);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-control border border-line-strong px-3 py-2.5 text-start hover:border-brand disabled:opacity-50"
                >
                  <span>
                    <b className="block text-[14px]">
                      {variant.size} · {variant.color}
                    </b>
                    <span className={cn("text-[12px]", left <= 0 ? "text-bad-ink" : "text-muted")}>
                      {left <= 0 ? t("outOfStock") : t("inStock", { count: left })}
                    </span>
                  </span>
                  <b className="text-[14px] text-brand tabular-nums">{money(variant.price)}</b>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

function TicketPanel({
  ticket,
  wallets,
  loyalty,
  discountText,
  onDiscount,
  payment,
  onPayment,
  receivedText,
  onReceived,
  change,
  onQuantity,
  onClear,
  charge,
}: {
  ticket: ReturnType<typeof computeTicket>;
  wallets: OpenCheckout["wallets"];
  loyalty: ReactNode;
  discountText: string;
  onDiscount: (text: string) => void;
  payment: Payment;
  onPayment: (payment: Payment) => void;
  receivedText: string;
  onReceived: (text: string) => void;
  change: number | null;
  onQuantity: (variantId: string, quantity: number) => void;
  onClear: () => void;
  charge: ReactNode;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const [discountOpen, setDiscountOpen] = useState(false);
  const paymentOptions = [
    { key: "cash", label: t("cash"), value: { method: "cash" } as Payment },
    ...wallets.map((wallet) => ({
      key: wallet.id,
      label: wallet.provider,
      value: { method: "wallet", walletAccountId: wallet.id } as Payment,
    })),
  ];
  const selected = payment.method === "cash" ? "cash" : payment.walletAccountId;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">{t("ticketTitle")}</h2>
          {ticket.lines.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[13px] font-semibold text-bad-ink"
            >
              {t("clearTicket")}
            </button>
          )}
        </div>
        {loyalty}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {ticket.lines.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-muted">{t("emptyCart")}</p>
        ) : (
          <ul>
            {ticket.lines.map((line) => (
              <li
                key={line.variantId}
                className="flex items-center gap-2.5 border-b border-tile py-3"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] font-semibold">{line.productName}</b>
                  <span
                    className={cn(
                      "block text-[12px]",
                      line.soldOut ? "font-semibold text-bad-ink" : "text-muted",
                    )}
                  >
                    {line.soldOut
                      ? t("lineSoldOut")
                      : `${line.size} · ${line.color} · ${t("unitPrice", { price: money(line.unitPrice) })}`}
                  </span>
                </span>
                <IconButton
                  size="sm"
                  label={line.quantity === 1 ? t("remove") : t("decrease")}
                  onClick={() => onQuantity(line.variantId, line.quantity - 1)}
                  className="text-brand"
                >
                  <Icon name={line.quantity === 1 ? "trash" : "minus"} className="size-4" />
                </IconButton>
                <output className="w-6 text-center font-bold tabular-nums">{line.quantity}</output>
                <IconButton
                  size="sm"
                  label={t("increase")}
                  disabled={line.quantity >= line.stock}
                  onClick={() => onQuantity(line.variantId, line.quantity + 1)}
                  className="text-brand"
                >
                  <Icon name="plus" className="size-4" />
                </IconButton>
                <b className="w-20 text-end text-[14px] tabular-nums">
                  {money(line.unitPrice * line.quantity)}
                </b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line-soft bg-surface-2 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {discountOpen || discountText ? (
          <Field label={t("discount")}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                dir="ltr"
                value={discountText}
                onChange={(e) => onDiscount(e.target.value)}
                className="h-10"
              />
            )}
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setDiscountOpen(true)}
            className="self-start text-[13px] font-semibold text-brand"
          >
            + {t("discount")}
          </button>
        )}
        <dl className="flex flex-col gap-1 text-[14px] text-muted tabular-nums">
          <div className="flex justify-between">
            <dt>{t("itemCount", { count: ticket.itemCount })}</dt>
            <dd>
              {t("subtotal")} {money(ticket.subtotal)}
            </dd>
          </div>
          {ticket.discount > 0 && (
            <div className="flex justify-between">
              <dt>{t("discount")}</dt>
              <dd>−{money(ticket.discount)}</dd>
            </div>
          )}
          {ticket.loyaltyDiscount > 0 && (
            <div className="flex justify-between">
              <dt>{t("loyaltyReward")}</dt>
              <dd>−{money(ticket.loyaltyDiscount)}</dd>
            </div>
          )}
        </dl>
        <div className="flex items-baseline justify-between">
          <b className="text-[15px]">{t("toPay")}</b>
          <b className="text-[32px] leading-none tracking-[-0.6px] text-brand tabular-nums">
            {money(ticket.total)}
          </b>
        </div>
        {ticket.pointsEarned !== null && (
          <p className="text-[12px] text-muted">
            {t("loyaltyWillEarn", { points: ticket.pointsEarned })}
          </p>
        )}

        <div role="radiogroup" aria-label={t("paymentMethod")} className="grid grid-cols-3 gap-1.5">
          {paymentOptions.map((option) => (
            <label
              key={option.key}
              className="flex h-10 cursor-pointer items-center justify-center truncate rounded-control border border-line-strong bg-surface px-2 text-[13px] font-semibold text-ink-2 has-checked:border-brand has-checked:bg-tint-soft has-checked:text-brand has-checked:shadow-[0_0_0_1px_var(--brand)] has-focus-visible:outline-2 has-focus-visible:outline-brand"
            >
              <input
                type="radio"
                name="payment"
                className="sr-only"
                checked={selected === option.key}
                onChange={() => onPayment(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {payment.method === "cash" ? (
          <div className="flex items-center gap-2">
            <label htmlFor="cash-received" className="flex-none text-[13px] font-semibold">
              {t("amountReceived")}
            </label>
            <Input
              id="cash-received"
              inputMode="decimal"
              dir="ltr"
              value={receivedText}
              onChange={(event) => onReceived(event.target.value)}
              className="h-10 text-end text-[15px]"
            />
            <span aria-live="polite" className="flex-none text-[13px] text-muted">
              {change === null ? null : change >= 0 ? (
                <>
                  {t("changeShort")} <b className="text-ok-ink">{money(change)}</b>
                </>
              ) : (
                <b className="text-bad-ink">{t("amountTooLow", { amount: money(-change) })}</b>
              )}
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-muted">{t("walletCheckHint")}</p>
        )}
        {charge}
      </div>
    </div>
  );
}

// The customer's loyalty card, found by phone number, or created with it.
function LoyaltyPicker({
  rule,
  card,
  redeem,
  onCard,
  onRedeem,
}: {
  rule: OpenCheckout["loyaltyRule"];
  card: LoyaltyCard | null;
  redeem: boolean;
  onCard: (card: LoyaltyCard | null) => void;
  onRedeem: (redeem: boolean) => void;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const format = useFormatter();
  const showError = useCommandError("pos.error");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [missing, setMissing] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: () => lookupLoyaltyCard({ data: { phone } }),
    onSuccess: (result) => {
      if (result.error)
        return notify({
          tone: "error",
          title: t(`loyaltyError.${result.error === "invalid" ? "invalidPhone" : result.error}`),
        });
      if (result.card) attach(result.card);
      else setMissing(phone);
    },
    onError: showError,
  });
  const enroll = useMutation({
    mutationFn: () => enrollLoyaltyCard({ data: { phone: missing ?? phone, name } }),
    onSuccess: (result) => {
      if (result.error)
        return notify({
          tone: "error",
          title: t(`loyaltyError.${result.error === "invalid" ? "invalidPhone" : result.error}`),
        });
      if (result.card) {
        attach(result.card);
        notify({ title: t("loyaltyEnrolled") });
      }
    },
    onError: showError,
  });

  // The typed number goes as soon as a card is on the ticket: the next sale
  // must never pick the previous customer's card up by accident.
  function attach(found: LoyaltyCard) {
    onCard(found);
    setPhone("");
    setName("");
    setMissing(null);
  }

  if (card) {
    const enough = card.points >= rule.rewardPoints;
    return (
      <div className="flex flex-col gap-2 rounded-control border border-line bg-bg p-3">
        <div className="flex items-start gap-2.5">
          <Icon name="star" className="mt-0.5 text-brand" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14px]">{card.name || card.phone}</b>
            <span dir="ltr" className="text-[12px] text-muted">
              {card.phone}
            </span>
            <span className="block text-[12px] font-semibold">
              {t("loyaltyBalance", { points: card.points })}
            </span>
          </span>
          <IconButton
            size="sm"
            variant="quiet"
            label={t("loyaltyDetach")}
            onClick={() => onCard(null)}
          >
            <Icon name="close" className="size-4" />
          </IconButton>
        </div>
        {enough ? (
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand"
              checked={redeem}
              onChange={(e) => onRedeem(e.target.checked)}
            />
            {t("loyaltyRedeem", {
              value: money(rule.rewardValue),
              points: format.number(rule.rewardPoints),
            })}
          </label>
        ) : (
          <p className="text-[12px] text-muted">
            {t("loyaltyNotEnough", { points: rule.rewardPoints - card.points })}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (phone.trim()) lookup.mutate();
      }}
    >
      <div className="flex items-end gap-2">
        <Field label={t("loyaltyCard")} className="flex-1">
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="off"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setMissing(null);
              }}
              className="h-10"
            />
          )}
        </Field>
        <Button type="submit" busy={lookup.isPending} disabled={!phone.trim()}>
          {t("loyaltyLookup")}
        </Button>
      </div>
      {missing && (
        <div className="flex flex-col gap-2 rounded-control bg-bg p-3">
          <p className="text-[13px]">{t("loyaltyNotFound")}</p>
          <div className="flex items-end gap-2">
            <Field label={t("loyaltyName")} className="flex-1">
              {(control) => (
                <Input
                  {...control}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10"
                />
              )}
            </Field>
            <Button
              type="button"
              variant="primary"
              busy={enroll.isPending}
              onClick={() => enroll.mutate()}
            >
              {t("loyaltyEnroll")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
