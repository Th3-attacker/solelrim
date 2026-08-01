import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function ProductsIndexRedirect({
  params,
}: {
  params: Promise<{ storeType: string }>;
}) {
  const [{ storeType }, locale] = await Promise.all([params, getLocale()]);
  redirect({ href: `/${storeType}`, locale });
}
