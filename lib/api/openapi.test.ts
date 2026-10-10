import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import spec from "@/docs/openapi.json";

// Every /api/v1 route file must be described in docs/openapi.json, with the
// same HTTP methods, so the spec the app generates its client from can't
// silently fall behind the code.
const ROOT = join(process.cwd(), "app/api/v1");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

async function exportedMethods(file: string): Promise<string[]> {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(file, "utf8");
  return [...source.matchAll(/^export const (GET|POST|DELETE|PUT|PATCH) =/gm)].map((m) => m[1].toLowerCase());
}

describe("docs/openapi.json", () => {
  const paths = spec.paths as Record<string, Record<string, unknown>>;

  it("describes every /api/v1 route and its methods", async () => {
    for (const file of routeFiles(ROOT)) {
      const route =
        "/" +
        relative(ROOT, file)
          .split(sep)
          .slice(0, -1)
          .join("/")
          .replace(/\[(\w+)\]/g, "{$1}");
      if (route === "/openapi.json" || route === "/docs") continue;
      expect(paths, `missing ${route}`).toHaveProperty([route]);
      for (const method of await exportedMethods(file)) {
        expect(paths[route], `missing ${method.toUpperCase()} ${route}`).toHaveProperty([method]);
      }
    }
  });
});
