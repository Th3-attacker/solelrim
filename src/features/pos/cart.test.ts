import { describe, expect, it } from "vitest";
import { addToCart, changeDue, computeTicket, setQuantity, type CatalogVariant } from "./cart";

const tee: CatalogVariant = { id: "v1", size: "M", color: "Noir", price: 200, stock: 2 };
const cap: CatalogVariant = { id: "v2", size: "TU", color: "Blanc", price: 150, stock: 0 };
const variants = new Map([
  [tee.id, tee],
  [cap.id, cap],
]);
const rule = { enabled: true, spendPerPoint: 100, rewardPoints: 100, rewardValue: 1000 };

describe("addToCart / setQuantity", () => {
  it("adds a line, then counts it up to what is in stock", () => {
    let cart = addToCart([], { name: "T-shirt" }, tee);
    cart = addToCart(cart, { name: "T-shirt" }, tee);
    cart = addToCart(cart, { name: "T-shirt" }, tee);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it("never adds what is sold out", () => {
    expect(addToCart([], { name: "Casquette" }, cap)).toEqual([]);
  });

  it("takes a line out at zero, caps it at the stock", () => {
    const cart = addToCart([], { name: "T-shirt" }, tee);
    expect(setQuantity(cart, "v1", 9, 2)[0].quantity).toBe(2);
    expect(setQuantity(cart, "v1", 0, 2)).toEqual([]);
  });
});

describe("computeTicket", () => {
  const cart = addToCart(addToCart([], { name: "T-shirt" }, tee), { name: "T-shirt" }, tee);

  it("adds the lines up, takes the discount off, within bounds", () => {
    const ticket = computeTicket({
      entries: cart,
      variants,
      discount: 50,
      loyaltyRule: rule,
      card: null,
      redeem: false,
    });
    expect(ticket).toMatchObject({
      subtotal: 400,
      discount: 50,
      total: 350,
      itemCount: 2,
      chargeable: true,
    });
    expect(
      computeTicket({
        entries: cart,
        variants,
        discount: 9999,
        loyaltyRule: rule,
        card: null,
        redeem: false,
      }).total,
    ).toBe(0);
    expect(
      computeTicket({
        entries: cart,
        variants,
        discount: -5,
        loyaltyRule: rule,
        card: null,
        redeem: false,
      }).discount,
    ).toBe(0);
  });

  it("applies a reward only with enough points, never below zero", () => {
    const card = { clientId: "c1", name: "Awa", phone: "22000000", points: 120 };
    const rich = computeTicket({
      entries: cart,
      variants,
      discount: 0,
      loyaltyRule: rule,
      card,
      redeem: true,
    });
    expect(rich).toMatchObject({
      redeeming: true,
      loyaltyDiscount: 400,
      total: 0,
      pointsEarned: 0,
    });
    const poor = computeTicket({
      entries: cart,
      variants,
      discount: 0,
      loyaltyRule: rule,
      card: { ...card, points: 10 },
      redeem: true,
    });
    expect(poor).toMatchObject({ redeeming: false, total: 400, pointsEarned: 4 });
  });

  it("refuses to charge while a line is sold out", () => {
    const withSoldOut = [
      ...cart,
      {
        variantId: "v2",
        quantity: 1,
        productName: "Casquette",
        size: "TU",
        color: "Blanc",
        lastPrice: 150,
      },
    ];
    const ticket = computeTicket({
      entries: withSoldOut,
      variants,
      discount: 0,
      loyaltyRule: rule,
      card: null,
      redeem: false,
    });
    expect(ticket.chargeable).toBe(false);
    expect(ticket.subtotal).toBe(400);
  });

  it("reads prices from the latest catalog", () => {
    const repriced = new Map(variants).set("v1", { ...tee, price: 250 });
    expect(
      computeTicket({
        entries: cart,
        variants: repriced,
        discount: 0,
        loyaltyRule: rule,
        card: null,
        redeem: false,
      }).total,
    ).toBe(500);
  });
});

describe("changeDue", () => {
  it("is what to hand back, negative when money is missing", () => {
    expect(changeDue(1000, 720)).toBe(280);
    expect(changeDue(500, 720)).toBe(-220);
    expect(changeDue(null, 720)).toBeNull();
  });
});
