import { config } from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local", quiet: true });

const ADMIN_EMAIL = process.env.SETUP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SETUP_ADMIN_PASSWORD;

async function main() {
  const supabase = createAdminClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (!buckets.some((b) => b.name === "product-images")) {
    const { error } = await supabase.storage.createBucket("product-images", {
      public: true,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (error) throw error;
    console.log('Created storage bucket "product-images" (public).');
  } else {
    console.log('Storage bucket "product-images" already exists — skipping.');
  }

  if (!buckets.some((b) => b.name === "payment-proofs")) {
    const { error } = await supabase.storage.createBucket("payment-proofs", {
      public: false,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (error) throw error;
    console.log('Created storage bucket "payment-proofs" (private).');
  } else {
    console.log('Storage bucket "payment-proofs" already exists — skipping.');
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("SETUP_ADMIN_EMAIL/SETUP_ADMIN_PASSWORD not set — skipping admin user creation.");
    return;
  }

  const { data: existing } = await supabase.auth.admin.listUsers();
  const alreadyExists = existing.users.some((u) => u.email === ADMIN_EMAIL);

  if (alreadyExists) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists — skipping.`);
    return;
  }

  const { error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (createError) throw createError;

  console.log(`Created admin user ${ADMIN_EMAIL}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
