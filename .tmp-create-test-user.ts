import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createAdminClient } from "./lib/supabase/admin";

const EMAIL = "verify-tmp-solelrim@example.com";
const PASSWORD = "Verify-Tmp-9284!";

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log("USER_ID:", data.user.id);
  console.log("EMAIL:", EMAIL);
  console.log("PASSWORD:", PASSWORD);
}

main();
