"use client";

import { useState } from "react";
import {
  ArrowRight,
  EnvelopeSimple,
  MagnifyingGlass,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type HelpTopicView = {
  id: string;
  title: string;
  when: string;
  steps: string[];
  issues: string[];
  href?: string;
  support: boolean;
  whatsappUrl: string | null;
  mailUrl: string | null;
};

export type HelpGroupView = { key: string; label: string; topics: HelpTopicView[] };

export type HelpLabels = {
  search: string;
  noResults: string;
  when: string;
  steps: string;
  prepare: string;
  issues: string;
  openPage: string;
  supportBadge: string;
  whatsapp: string;
  email: string;
  noContact: string;
};

function matches(topic: HelpTopicView, query: string) {
  const haystack = [topic.title, topic.when, ...topic.steps, ...topic.issues]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function SupportButtons({ topic, labels }: { topic: HelpTopicView; labels: HelpLabels }) {
  if (!topic.whatsappUrl && !topic.mailUrl) {
    return <p className="text-muted-foreground">{labels.noContact}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {topic.whatsappUrl && (
        <Button asChild size="sm">
          <a href={topic.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <WhatsappLogo className="size-4" />
            {labels.whatsapp}
          </a>
        </Button>
      )}
      {topic.mailUrl && (
        <Button asChild size="sm" variant="outline">
          <a href={topic.mailUrl}>
            <EnvelopeSimple className="size-4" />
            {labels.email}
          </a>
        </Button>
      )}
    </div>
  );
}

export function HelpGuide({ groups, labels }: { groups: HelpGroupView[]; labels: HelpLabels }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = groups
    .map((group) => ({
      ...group,
      topics: group.topics.filter((topic) => !needle || matches(topic, needle)),
    }))
    .filter((group) => group.topics.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="ps-9"
        />
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {labels.noResults.replace("{query}", query.trim())}
        </p>
      )}

      {visible.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{group.label}</h2>
          <Accordion type="multiple" className="rounded-xl border bg-card px-4">
            {group.topics.map((topic) => (
              <AccordionItem key={topic.id} value={topic.id}>
                <AccordionTrigger>
                  <span className="flex flex-wrap items-center gap-2">
                    {topic.title}
                    {topic.support && <Badge variant="info">{labels.supportBadge}</Badge>}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-3">
                    <p>
                      <span className="font-medium">{labels.when} : </span>
                      {topic.when}
                    </p>
                    <div>
                      <p className="mb-1 font-medium">
                        {topic.support ? labels.prepare : labels.steps}
                      </p>
                      <ol className="list-decimal space-y-1 ps-5">
                        {topic.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    {topic.issues.length > 0 && (
                      <div>
                        <p className="mb-1 font-medium">{labels.issues}</p>
                        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                          {topic.issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {topic.support && <SupportButtons topic={topic} labels={labels} />}
                    {topic.href && (
                      <Button asChild size="sm" variant="outline" className="w-fit">
                        <Link href={topic.href}>
                          {labels.openPage}
                          <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
