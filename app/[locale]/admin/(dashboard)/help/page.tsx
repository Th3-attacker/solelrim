import { getTranslations } from "next-intl/server";
import { getCurrentAdmin, getSessionUser } from "@/lib/auth/admin";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { getSolalContact } from "@/lib/queries/settings";
import { HELP_GROUPS, topicsFor } from "@/lib/help/topics";
import { mailtoLink, whatsappLink } from "@/lib/help/support-links";
import { Button } from "@/components/ui/button";
import { StatusAlert } from "@/components/ui/status-alert";
import { HelpGuide, type HelpGroupView } from "@/components/help/help-guide";

// Open to every signed-in role, sellers included (proxy.ts lets /admin/help
// through for them): the topics shown depend on the role, and what only the
// support team can do carries ready-to-send WhatsApp / e-mail messages.
export default async function HelpPage() {
  const admin = await getCurrentAdmin();
  const isSeller = admin.role === "SELLER";
  const [t, user, contact, boutique] = await Promise.all([
    getTranslations("help"),
    getSessionUser().catch(() => null),
    getSolalContact(),
    isSeller ? Promise.resolve(admin.productType ?? "") : getAdminScope(),
  ]);
  const email = user?.email ?? "";

  const supportLinks = (topicTitle: string) => {
    const values = { email, boutique, topic: topicTitle };
    return {
      whatsappUrl: whatsappLink(contact.phone, t("whatsappMessage", values)),
      mailUrl: mailtoLink(contact.email, t("emailSubject", values), t("emailBody", values)),
    };
  };

  const topics = topicsFor(isSeller ? "seller" : "admin");
  const groups: HelpGroupView[] = HELP_GROUPS.map((group) => ({
    key: group,
    label: t(`groups.${group}`),
    topics: topics
      .filter((topic) => topic.group === group)
      .map((topic) => {
        const title = t(`topics.${topic.id}.title`);
        return {
          id: topic.id,
          title,
          when: t(`topics.${topic.id}.when`),
          steps: t.raw(`topics.${topic.id}.steps`) as string[],
          issues: t.has(`topics.${topic.id}.issues`)
            ? (t.raw(`topics.${topic.id}.issues`) as string[])
            : [],
          href: topic.href,
          support: topic.support === true,
          ...(topic.support ? supportLinks(title) : { whatsappUrl: null, mailUrl: null }),
        };
      }),
  })).filter((group) => group.topics.length > 0);

  const general = supportLinks(t("generalTopic"));
  const hasContact = Boolean(general.whatsappUrl || general.mailUrl);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <HelpGuide
        groups={groups}
        labels={{
          search: t("search"),
          // Filled in by the client with the typed text.
          noResults: t.raw("noResults") as string,
          when: t("when"),
          steps: t("steps"),
          prepare: t("prepare"),
          issues: t("issues"),
          openPage: t("openPage"),
          supportBadge: t("supportBadge"),
          whatsapp: t("whatsapp"),
          email: t("email"),
          noContact: t("noContact"),
        }}
      />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">{t("contactTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
        </div>
        {hasContact ? (
          <div className="flex flex-wrap gap-2">
            {general.whatsappUrl && (
              <Button asChild size="sm">
                <a href={general.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  {t("whatsapp")}
                </a>
              </Button>
            )}
            {general.mailUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={general.mailUrl}>{t("email")}</a>
              </Button>
            )}
          </div>
        ) : (
          <StatusAlert variant="warning">{t("noContact")}</StatusAlert>
        )}
      </section>
    </div>
  );
}
