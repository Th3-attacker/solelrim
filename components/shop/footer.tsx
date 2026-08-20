import Image from "next/image";
import { ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type FooterCategory = { id: string; name: string };
type FooterSocialLink = { id: string; href: string; label: string };

type FooterProps = {
  variant: string;
  siteName: string;
  logoUrl: string | null;
  basePath: string;
  categories: FooterCategory[];
  whatsappHref: string | null;
  socialLinks: FooterSocialLink[];
};

// Admin-configurable (StoreType.footerVariant, superadmin/appearance-scoped
// — see setFooterVariant): "columns" is the original, information-dense
// footer kept as the default so existing boutiques don't change on
// deploy; "minimal" and "centered" trade that density for a smaller
// footprint / a brand-forward look, same underlying links either way.
export async function Footer(props: FooterProps) {
  const t = await getTranslations("shop");

  switch (props.variant) {
    case "minimal":
      return <MinimalFooter {...props} t={t} />;
    case "centered":
      return <CenteredFooter {...props} t={t} />;
    default:
      return <ColumnsFooter {...props} t={t} />;
  }
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function BrandMark({
  siteName,
  logoUrl,
  basePath,
  size = 28,
  className = "",
}: {
  siteName: string;
  logoUrl: string | null;
  basePath: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href={basePath || "/"}
      className={`flex items-center gap-2 font-bold text-white ${className}`}
    >
      {logoUrl && (
        <Image
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className="shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      )}
      {siteName}
    </Link>
  );
}

function WhatsappLink({ whatsappHref, t }: { whatsappHref: string | null; t: Translate }) {
  if (!whatsappHref) return null;
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 transition-colors hover:text-white"
    >
      <ChatCircle className="size-4" />
      {t("contactWhatsapp")}
    </a>
  );
}

function ColumnsFooter({
  siteName,
  logoUrl,
  basePath,
  categories,
  whatsappHref,
  socialLinks,
  t,
}: FooterProps & { t: Translate }) {
  return (
    <footer className="border-t bg-zinc-950 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-12 desktop:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
            <BrandMark
              siteName={siteName}
              logoUrl={logoUrl}
              basePath={basePath}
              className="text-base"
            />
            <p className="max-w-52 text-sm text-zinc-500">{t("heroSubtitle")}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              {t("footerShopTitle")}
            </h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href={`${basePath}/products`} className="transition-colors hover:text-white">
                {t("allProductsTitle")}
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={{
                    pathname: `${basePath}/products`,
                    query: { category: category.id },
                  }}
                  className="transition-colors hover:text-white"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              {t("footerHelpTitle")}
            </h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href={`${basePath}/about`} className="transition-colors hover:text-white">
                {t("aboutLink")}
              </Link>
              <Link href={`${basePath}/contact`} className="transition-colors hover:text-white">
                {t("contactLink")}
              </Link>
              <Link href={`${basePath}/legal`} className="transition-colors hover:text-white">
                {t("legalLink")}
              </Link>
              <Link href={`${basePath}/track-order`} className="transition-colors hover:text-white">
                {t("trackOrderLink")}
              </Link>
              <WhatsappLink whatsappHref={whatsappHref} t={t} />
            </nav>
          </div>

          {socialLinks.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                {t("footerFollowTitle")}
              </h3>
              <nav className="flex flex-col gap-2 text-sm">
                {socialLinks.map((social) => (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white"
                  >
                    {social.label}
                  </a>
                ))}
              </nav>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {siteName}
        </div>
      </div>
    </footer>
  );
}

// A single compact row instead of a four-column grid — for a boutique with
// a small catalog (few/no categories worth their own column) or an admin
// who just wants the footer out of the way.
function MinimalFooter({
  siteName,
  logoUrl,
  basePath,
  whatsappHref,
  socialLinks,
  t,
}: FooterProps & { t: Translate }) {
  return (
    <footer className="border-t bg-zinc-950 text-zinc-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 desktop:px-8 sm:flex-row sm:justify-between">
        <BrandMark siteName={siteName} logoUrl={logoUrl} basePath={basePath} size={24} className="text-sm" />

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link href={`${basePath}/products`} className="transition-colors hover:text-white">
            {t("allProductsTitle")}
          </Link>
          <Link href={`${basePath}/about`} className="transition-colors hover:text-white">
            {t("aboutLink")}
          </Link>
          <Link href={`${basePath}/contact`} className="transition-colors hover:text-white">
            {t("contactLink")}
          </Link>
          <Link href={`${basePath}/legal`} className="transition-colors hover:text-white">
            {t("legalLink")}
          </Link>
          <WhatsappLink whatsappHref={whatsappHref} t={t} />
        </nav>

        <div className="flex items-center gap-4 text-xs text-zinc-600">
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              {socialLinks.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {social.label}
                </a>
              ))}
            </div>
          )}
          <span>© {new Date().getFullYear()} {siteName}</span>
        </div>
      </div>
    </footer>
  );
}

// Everything stacked and centered around the brand instead of laid out as
// a directory of links — reads as a closing statement rather than a
// sitemap, for a boutique that wants the footer to feel editorial.
function CenteredFooter({
  siteName,
  logoUrl,
  basePath,
  whatsappHref,
  socialLinks,
  t,
}: FooterProps & { t: Translate }) {
  return (
    <footer className="border-t bg-zinc-950 text-zinc-400">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center desktop:px-8">
        <BrandMark siteName={siteName} logoUrl={logoUrl} basePath={basePath} size={32} className="text-lg" />
        <p className="max-w-sm text-sm text-zinc-500">{t("heroSubtitle")}</p>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href={`${basePath}/products`} className="transition-colors hover:text-white">
            {t("allProductsTitle")}
          </Link>
          <Link href={`${basePath}/about`} className="transition-colors hover:text-white">
            {t("aboutLink")}
          </Link>
          <Link href={`${basePath}/contact`} className="transition-colors hover:text-white">
            {t("contactLink")}
          </Link>
          <Link href={`${basePath}/legal`} className="transition-colors hover:text-white">
            {t("legalLink")}
          </Link>
          <Link href={`${basePath}/track-order`} className="transition-colors hover:text-white">
            {t("trackOrderLink")}
          </Link>
          <WhatsappLink whatsappHref={whatsappHref} t={t} />
        </nav>

        {socialLinks.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {socialLinks.map((social) => (
              <a
                key={social.id}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                {social.label}
              </a>
            ))}
          </nav>
        )}

        <div className="border-t border-white/10 pt-6 text-xs text-zinc-500">
          © {new Date().getFullYear()} {siteName}
        </div>
      </div>
    </footer>
  );
}
