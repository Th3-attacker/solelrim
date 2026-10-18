import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getTranslations } from "next-intl/server";
import { shopPageBoundaries } from "@/components/errors/shop-boundaries";
import { TrackOrderForm } from "@/components/shop/track-order-form";
import { resolveMetadata } from "@/lib/seo/head";
import { getShopPageContext } from "@/src/server/shop";
import { stringFields } from "@/src/server/validators";

// Ex-app/[locale]/[storeType]/(shop)/track-order/page.tsx.

// A per-customer utility page (empty form, no unique copy) rather than a
// keyword-targeted one — indexing it across every boutique would just be
// near-identical thin content competing with the actual product/category
// pages for crawl budget, so it's excluded from search while staying
// perfectly reachable for anyone who already has the link.
const loadTrackOrder = createServerFn({ method: "GET" })
  .validator(stringFields("storeType"))
  .handler(async ({ data: { storeType } }) => {
    const { boutique, siteName } = await getShopPageContext(storeType);
    const t = await getTranslations("trackOrder");

    return {
      meta: resolveMetadata({
        title: `${t("title")} — ${siteName}`,
        description: t("subtitle"),
        robots: { index: false, follow: true },
      }),
      adminWhatsappNumber: boutique.adminWhatsappNumber,
    };
  });

export const Route = createFileRoute("/$locale/$storeType/_shop/track-order")({
  loader: ({ params }) => loadTrackOrder({ data: { storeType: params.storeType } }),
  component: TrackOrderPage,
  ...shopPageBoundaries,
});

function TrackOrderPage() {
  const { adminWhatsappNumber } = Route.useLoaderData();
  return <TrackOrderForm adminWhatsappNumber={adminWhatsappNumber} />;
}
