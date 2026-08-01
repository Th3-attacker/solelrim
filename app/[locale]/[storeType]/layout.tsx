import { notFound } from "next/navigation";
import { getStoreTypes } from "@/lib/queries/settings";

export async function generateStaticParams() {
  const storeTypes = await getStoreTypes();
  return storeTypes.map((storeType) => ({ storeType: storeType.key }));
}

// Every route under here assumes storeType is a real boutique — this is the
// single choke point that guarantees that, so no individual page has to
// re-check it before querying by productType.
export default async function StoreTypeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeType: string }>;
}) {
  const { storeType } = await params;
  const storeTypes = await getStoreTypes();
  if (!storeTypes.some((type) => type.key === storeType)) {
    notFound();
  }

  return children;
}
