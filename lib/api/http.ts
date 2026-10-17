import { routing } from "@/i18n/routing";

// Shared plumbing of the public mobile API (/api/v1). Every answer is JSON;
// an error is always { error: "<code>" } with the same codes the Server
// Actions use ("invalid", "rateLimited", "notFound"...), so the app handles
// one vocabulary whichever way it reaches the shop.

// How long a catalogue answer may be reused by the CDN and the app. Short,
// because stock moves; stale-while-revalidate keeps scrolling snappy.
const CATALOG_CACHE = "public, s-maxage=30, stale-while-revalidate=60";

export function ok(data: unknown, options?: { cache?: boolean }): Response {
  return Response.json(data, {
    headers: options?.cache ? { "Cache-Control": CATALOG_CACHE } : { "Cache-Control": "no-store" },
  });
}

export function fail(
  error: string,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } },
  );
}

// The HTTP status of an error code coming back from a Server Action.
const STATUS_BY_ERROR: Record<string, number> = {
  invalid: 400,
  invalidFile: 400,
  fileTooLarge: 413,
  notFound: 404,
  storefrontExpired: 403,
  rateLimited: 429,
  uploadFailed: 502,
  insufficientStock: 409,
  alreadyUsed: 409,
  referenceCollision: 409,
  transactionAlreadyUsed: 409,
};

// retryAfter (seconds) comes with "rateLimited" and becomes Retry-After.
export function failFromCode(error: string, retryAfter?: number): Response {
  const headers = retryAfter !== undefined ? { "Retry-After": String(retryAfter) } : undefined;
  return fail(error, STATUS_BY_ERROR[error] ?? 422, headers);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ?locale=fr|en|ar — anything else falls back to the default (French).
export function localeOf(url: URL): string {
  const wanted = url.searchParams.get("locale");
  const locales: readonly string[] = routing.locales;
  return wanted && locales.includes(wanted) ? wanted : routing.defaultLocale;
}

export function pageOf(url: URL, defaultSize = 20, maxSize = 50) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1);
  const size = Math.floor(Number(url.searchParams.get("pageSize"))) || defaultSize;
  return { page, pageSize: Math.min(Math.max(size, 1), maxSize) };
}

// The catalogue's sort and filters (GET .../products). null when none is
// given: the route then answers exactly as before they existed. "invalid"
// for a value the API refuses.
const CATALOGUE_PARAMS = ["sort", "sizes", "colors", "priceMin", "priceMax", "facets"] as const;
const SORTS: readonly string[] = ["popular", "price_asc", "price_desc", "newest"];
const MAX_LIST_VALUES = 20;
const PRICE = /^\d{1,9}$/;

export type CatalogueParams = {
  sort: "popular" | "price_asc" | "price_desc" | "newest";
  sizes: string[];
  colors: string[];
  priceMin?: number;
  priceMax?: number;
  facets: boolean;
};

export function catalogueParamsOf(url: URL): CatalogueParams | "invalid" | null {
  const params = url.searchParams;
  if (!CATALOGUE_PARAMS.some((name) => params.has(name))) return null;

  const sort = params.get("sort") ?? "popular";
  if (!SORTS.includes(sort)) return "invalid";

  // Comma-separated exact values; empty ones are ignored.
  const list = (name: string) =>
    (params.get(name) ?? "").split(",").filter((value) => value !== "");
  const sizes = list("sizes");
  const colors = list("colors");
  if (sizes.length > MAX_LIST_VALUES || colors.length > MAX_LIST_VALUES) return "invalid";

  const price = (name: string) => {
    const value = params.get(name);
    if (value === null || value === "") return undefined;
    return PRICE.test(value) ? Number(value) : null;
  };
  const priceMin = price("priceMin");
  const priceMax = price("priceMax");
  if (priceMin === null || priceMax === null) return "invalid";
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) return "invalid";

  const facets = params.get("facets");
  if (facets !== null && facets !== "1") return "invalid";

  return {
    sort: sort as CatalogueParams["sort"],
    sizes,
    colors,
    priceMin,
    priceMax,
    facets: facets === "1",
  };
}
