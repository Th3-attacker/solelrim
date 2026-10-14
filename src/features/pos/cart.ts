// The checkout's ticket, as pure arithmetic: what is in it, what it costs,
// what the customer pays. The server recomputes all of it (recordSale) and
// refuses the sale if its total differs from the one shown here.

export type CatalogVariant = {
  id: string;
  size: string;
  color: string;
  price: number;
  stock: number;
};

// What the ticket remembers of a line. Name, size and color label a line
// whose variant has since left the catalog; price and stock always come from
// the latest catalog.
export type CartEntry = {
  variantId: string;
  quantity: number;
  productName: string;
  size: string;
  color: string;
  lastPrice: number;
};

export type CartLine = CartEntry & { unitPrice: number; stock: number; soldOut: boolean };

export type LoyaltyRule = {
  enabled: boolean;
  spendPerPoint: number;
  rewardPoints: number;
  rewardValue: number;
};
export type LoyaltyCard = { clientId: string; name: string; phone: string; points: number };

export function addToCart(
  entries: CartEntry[],
  product: { name: string },
  variant: CatalogVariant,
): CartEntry[] {
  const existing = entries.find((entry) => entry.variantId === variant.id);
  if (existing) {
    if (existing.quantity >= variant.stock) return entries;
    return entries.map((entry) =>
      entry.variantId === variant.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
    );
  }
  if (variant.stock <= 0) return entries;
  return [
    ...entries,
    {
      variantId: variant.id,
      quantity: 1,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      lastPrice: variant.price,
    },
  ];
}

// A quantity of 0 takes the line out; never more than what is in stock.
export function setQuantity(
  entries: CartEntry[],
  variantId: string,
  quantity: number,
  stock: number,
): CartEntry[] {
  if (quantity <= 0) return entries.filter((entry) => entry.variantId !== variantId);
  return entries.map((entry) =>
    entry.variantId === variantId
      ? { ...entry, quantity: Math.min(quantity, Math.max(stock, 1)) }
      : entry,
  );
}

export function computeTicket({
  entries,
  variants,
  discount,
  loyaltyRule,
  card,
  redeem,
}: {
  entries: CartEntry[];
  variants: ReadonlyMap<string, CatalogVariant>;
  discount: number;
  loyaltyRule: LoyaltyRule;
  card: LoyaltyCard | null;
  redeem: boolean;
}) {
  const lines: CartLine[] = entries.map((entry) => {
    const variant = variants.get(entry.variantId);
    const stock = variant?.stock ?? 0;
    return {
      ...entry,
      unitPrice: variant?.price ?? entry.lastPrice,
      quantity: Math.min(entry.quantity, Math.max(stock, 1)),
      stock,
      soldOut: stock === 0,
    };
  });
  const sellable = lines.filter((line) => !line.soldOut);
  const subtotal = round(sellable.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  // Same rules as recordSale: the discount never goes below zero or above
  // the subtotal; a reward only applies when something is left to pay and
  // the card holds enough points, and never discounts below zero.
  const discountValue = Math.min(Math.max(discount, 0), subtotal);
  const redeeming =
    redeem &&
    card !== null &&
    card.points >= loyaltyRule.rewardPoints &&
    subtotal - discountValue > 0;
  const loyaltyDiscount = redeeming
    ? Math.min(loyaltyRule.rewardValue, subtotal - discountValue)
    : 0;
  const total = round(subtotal - discountValue - loyaltyDiscount);
  return {
    lines,
    // A sold-out line must be taken out first: what is charged is exactly
    // what the ticket shows.
    chargeable: sellable.length > 0 && sellable.length === lines.length,
    itemCount: sellable.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    discount: discountValue,
    redeeming,
    loyaltyDiscount,
    total,
    pointsEarned:
      card && loyaltyRule.enabled ? Math.floor(total / loyaltyRule.spendPerPoint) : null,
  };
}

// The change to hand back, or how much is missing (negative).
export function changeDue(received: number | null, total: number): number | null {
  return received === null ? null : round(received - total);
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100 || 0;
}
