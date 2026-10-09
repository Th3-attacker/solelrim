import { describe, expect, it } from "vitest";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { HELP_GROUPS, HELP_TOPICS, topicsFor } from "@/lib/help/topics";

const bundles = { fr: frMessages, en: enMessages, ar: arMessages } as const;

describe.each(Object.entries(bundles))("help topics in %s", (_locale, messages) => {
  const help = messages.help as unknown as {
    groups: Record<string, string>;
    topics: Record<string, { title: string; when: string; steps: string[]; issues?: string[] }>;
  };

  it("has a title, a context and steps for every topic", () => {
    for (const topic of HELP_TOPICS) {
      const texts = help.topics[topic.id];
      expect(texts, topic.id).toBeDefined();
      expect(texts.title, topic.id).toBeTruthy();
      expect(texts.when, topic.id).toBeTruthy();
      expect(texts.steps.length, topic.id).toBeGreaterThan(0);
    }
  });

  it("names every group", () => {
    for (const group of HELP_GROUPS) expect(help.groups[group], group).toBeTruthy();
  });

  it("has no text for a topic that no longer exists", () => {
    const ids = new Set(HELP_TOPICS.map((topic) => topic.id));
    for (const id of Object.keys(help.topics)) expect(ids.has(id), id).toBe(true);
  });
});

describe("topicsFor", () => {
  it("keeps admin-only tasks away from sellers", () => {
    const seller = topicsFor("seller").map((topic) => topic.id);
    expect(seller).toContain("sellAtCheckout");
    expect(seller).not.toContain("closeDay");
    expect(seller).not.toContain("decideRefund");
  });

  it("gives an admin everything a seller sees", () => {
    const admin = new Set(topicsFor("admin").map((topic) => topic.id));
    for (const topic of topicsFor("seller")) expect(admin.has(topic.id)).toBe(true);
  });
});
