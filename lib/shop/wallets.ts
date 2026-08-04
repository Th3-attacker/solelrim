import type { WalletProvider } from "@/lib/generated/prisma/enums";

// Placeholder monogram badges — swap the files at these paths for the
// providers' official logos whenever they're available, no code change
// needed on either side (admin manager or checkout).
export const WALLET_PROVIDERS: Record<WalletProvider, { logo: string }> = {
  BANKILY: { logo: "/wallets/bankily.svg" },
  MASRIVY: { logo: "/wallets/masrivy.svg" },
};

export const WALLET_PROVIDER_KEYS = Object.keys(
  WALLET_PROVIDERS,
) as WalletProvider[];
