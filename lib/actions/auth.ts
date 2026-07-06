"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  locale: z.string(),
});

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const { email, password, locale } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "invalid" };
  }

  redirect({
    href: "/admin",
    locale: routing.locales.includes(locale as (typeof routing.locales)[number])
      ? locale
      : routing.defaultLocale,
  });
  return {};
}

export async function logout(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({
    href: "/admin/login",
    locale: routing.locales.includes(locale as (typeof routing.locales)[number])
      ? locale
      : routing.defaultLocale,
  });
}
