// The website's reads of public catalogue data, through the routes the app
// uses (/api/v1, same origin on every boutique domain). Unlike Server
// Actions, which a client runs one at a time, these run in parallel, a GET
// can be cached by the CDN, and a rate limit arrives as a 429.

export type ProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
};

export type SuggestionsResult =
  | { products: ProductSuggestion[] }
  | { error: "rateLimited"; retryAfter: number }
  | { error: "failed" };

export async function fetchProductSuggestions(
  productType: string,
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SuggestionsResult> {
  const params = new URLSearchParams({ q: query, pageSize: String(limit) });
  try {
    const response = await fetch(`/api/v1/boutiques/${encodeURIComponent(productType)}/products?${params}`, {
      signal,
    });
    if (response.status === 429) {
      return { error: "rateLimited", retryAfter: Number(response.headers.get("Retry-After")) || 60 };
    }
    if (!response.ok) return { error: "failed" };
    const body = (await response.json()) as {
      products: { id: string; slug: string; name: string; imageUrl: string | null; price: { min: number } }[];
    };
    return {
      products: body.products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price.min,
      })),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { error: "failed" };
  }
}

// Current stock per variant, or null when the check didn't happen (rate
// limit, bad list, no connection): the cart drops any variant missing from
// a real answer, so "no answer" must not look like "all sold out".
export async function fetchVariantStocks(
  productType: string,
  variantIds: string[],
): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`/api/v1/boutiques/${encodeURIComponent(productType)}/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { stocks: Record<string, number> };
    return body.stocks;
  } catch {
    return null;
  }
}
