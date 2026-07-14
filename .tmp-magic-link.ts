import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createAdminClient } from "./lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const admin = list.users[0];
  if (!admin?.email) throw new Error("No admin user found");

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: admin.email,
  });
  if (error) throw error;
  console.log("EMAIL:", admin.email);
  console.log("LINK:", data.properties.action_link);
}

main();
