import { expect, test } from "@playwright/test";
import { submitCheckoutOrder } from "./helpers";

test.describe("checkout", () => {
  test("customer can add to cart, fill in info, and submit an order", async ({ page }) => {
    const reference = await submitCheckoutOrder(page);
    expect(reference).toMatch(/^CMD-\d{8}-\d{4}$/);
  });
});
