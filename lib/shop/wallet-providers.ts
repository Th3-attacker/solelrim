// The wallet providers a boutique picks from. Choosing one shows its logo
// everywhere the wallet appears, with nothing to upload: the images are
// bundled in public/wallets/<key>.svg. To support another provider, add it
// here and drop its logo next to the others.
//
// The stored WalletAccount.provider stays the plain label, so accounts
// created before this list existed (free text) keep working: they match by
// label or alias, and the others fall back to the logo that was uploaded.

type WalletProvider = { key: string; label: string; aliases?: readonly string[] };

export const WALLET_PROVIDERS: readonly WalletProvider[] = [
  { key: "bankily", label: "Bankily" },
  // "Masrvi" is the real name; Masrivi / Masrivy are spellings used before.
  { key: "masrvi", label: "Masrvi", aliases: ["masrivi", "masrivy"] },
  { key: "sedad", label: "Sedad" },
  { key: "bimbank", label: "BimBank", aliases: ["bim bank", "bim"] },
];

const normalize = (name: string) => name.trim().toLowerCase();

export function findWalletProvider(name: string): WalletProvider | undefined {
  const wanted = normalize(name);
  return WALLET_PROVIDERS.find(
    (provider) =>
      normalize(provider.label) === wanted ||
      provider.aliases?.some((alias) => normalize(alias) === wanted),
  );
}

// The logo to show for a wallet: the bundled one of a known provider, else
// the image uploaded for it before (if any), else nothing (a generic icon).
export function walletLogoSrc(provider: string, uploadedUrl: string | null): string | null {
  const known = findWalletProvider(provider);
  return known ? `/wallets/${known.key}.svg` : uploadedUrl;
}
