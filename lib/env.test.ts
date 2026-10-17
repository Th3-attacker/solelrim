import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/solelrim",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("@/lib/env")).serverEnv;
}

afterEach(() => vi.unstubAllEnvs());

describe("serverEnv", () => {
  it("returns the variables when they are all there", async () => {
    const serverEnv = await load(VALID);
    expect(serverEnv()).toEqual(VALID);
  });

  it("names every missing or malformed one", async () => {
    const serverEnv = await load({
      ...VALID,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "not a url",
    });
    expect(() => serverEnv()).toThrow(
      "Missing or invalid environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
