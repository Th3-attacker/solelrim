import { getStoreSettings } from "@/lib/queries/settings";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  return <CheckoutFlow settings={settings} />;
}
