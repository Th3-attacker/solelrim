-- The provider is spelled "Masrvi". Wallets saved under the older spellings
-- (Masrivi, Masrivy) take the right name, so the checkout, the admin and the
-- mobile API (provider, providerKey "masrvi") all say it the same way.
-- Past orders and sales keep the name they were recorded with.
UPDATE "WalletAccount" SET "provider" = 'Masrvi'
WHERE lower(trim("provider")) IN ('masrivi', 'masrivy');
