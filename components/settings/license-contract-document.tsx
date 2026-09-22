import { formatPriceNumber } from "@/lib/format/currency";
import { getEffectiveLicenseState, type LicenseInfo } from "@/lib/shop/license";
import {
  LICENSE_PRICING,
  LICENSE_TERMS_UPDATED_AT,
  LICENSE_TERMS_VERSION,
} from "@/lib/legal/license-terms";
import type { LicenseType } from "@/lib/generated/prisma/enums";

// The full text of SOLAL's license terms, filled in for one specific
// boutique's contract (section 34) — see
// app/[locale]/admin/(dashboard)/settings/global/contracts/[productType]/page.tsx,
// the only route that renders this. Deliberately not run through
// next-intl: this is a formal French-language legal document for a
// Mauritanian client, not storefront UI copy that should follow whichever
// locale the admin happens to be browsing in — a mistranslated legal term
// is a real liability, so this content stays untranslated regardless of
// the active locale.
//
// Every field this pulls from `boutique` already drives the actual
// enforcement (lib/shop/admin-scope.ts: requireWritableAdminScope, the
// (shop) layout) — the printed contract and the running system can never
// silently drift apart, since there's no separate "contract database".

const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  MONTHLY: "Mensuelle",
  YEARLY: "Annuelle",
  PERPETUAL: "Définitive",
};

function placeholder(value: string | null): string {
  return value?.trim() ? value : "[à compléter]";
}

function formatDate(date: Date | null): string {
  if (!date) return "[à compléter]";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

function money(amount: number): string {
  return `${formatPriceNumber(amount)} MRU`;
}

type Boutique = LicenseInfo & {
  label: string;
  domain: string | null;
  licenseStartedAt: Date | null;
  licenseClientName: string | null;
};

type SolalContact = {
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export function LicenseContractDocument({
  boutique,
  solalContact,
}: {
  boutique: Boutique;
  solalContact: SolalContact;
}) {
  const effectiveState = getEffectiveLicenseState(boutique);

  return (
    <article className="flex flex-col gap-6 text-sm leading-relaxed">
      <header className="flex flex-col items-center gap-1 border-b pb-6 text-center">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          Conditions de licence d&apos;utilisation
        </h1>
        <p className="text-base font-semibold">SOLAL — Solution e-commerce</p>
        <p className="text-xs text-muted-foreground">
          Version : {LICENSE_TERMS_VERSION} · Date de mise à jour :{" "}
          {LICENSE_TERMS_UPDATED_AT}
        </p>
      </header>

      <Section n={1} title="Objet">
        <p>
          Les présentes Conditions de Licence définissent les conditions dans lesquelles{" "}
          <strong>SOLAL</strong>, ci-après dénommé « le Concédant », accorde à un client,
          ci-après dénommé « le Client », le droit d&apos;utiliser la solution e-commerce
          SOLAL.
        </p>
        <p>
          SOLAL est une solution permettant au Client d&apos;exploiter sa propre boutique
          e-commerce sous son identité commerciale.
        </p>
        <p>
          La licence porte sur le droit d&apos;utilisation de la solution et ne constitue
          pas une vente ou une cession du logiciel, de son code source ou de sa propriété
          intellectuelle.
        </p>
      </Section>

      <Section n={2} title="Définitions">
        <dl className="flex flex-col gap-2">
          <Definition term="« SOLAL »">
            Désigne la solution logicielle e-commerce, son interface, son administration,
            ses fonctionnalités, ses composants techniques et les évolutions développées
            par le Concédant.
          </Definition>
          <Definition term="« Boutique »">
            Désigne l&apos;espace e-commerce configuré pour le Client et exploité sous son
            identité commerciale.
          </Definition>
          <Definition term="« Client »">
            Désigne la personne physique ou morale ayant souscrit une licence SOLAL.
          </Definition>
          <Definition term="« Licence »">
            Désigne le droit accordé au Client d&apos;utiliser SOLAL conformément à la
            formule souscrite.
          </Definition>
          <Definition term="« Domaine »">
            Désigne le nom de domaine utilisé par le Client pour accéder à sa boutique.
          </Definition>
          <Definition term="« Fonctionnalité »">
            Désigne toute fonction proposée par SOLAL.
          </Definition>
        </dl>
      </Section>

      <Section n={3} title="Attribution de la licence">
        <p>Le Concédant accorde au Client une licence :</p>
        <List
          items={[
            "personnelle ;",
            "non exclusive ;",
            "non transférable, sauf accord écrit du Concédant ;",
            "limitée à l'utilisation de la Boutique définie lors de la souscription.",
          ]}
        />
        <p>
          La licence permet au Client d&apos;utiliser SOLAL pour exploiter son activité
          commerciale en ligne.
        </p>
        <p>
          La licence n&apos;autorise pas le Client à copier, distribuer, revendre ou
          commercialiser SOLAL lui-même.
        </p>
      </Section>

      <Section n={4} title="Propriété intellectuelle">
        <p>
          SOLAL, son code source, son architecture, ses composants logiciels, ses
          interfaces, ses méthodes techniques, ses systèmes de gestion, ses
          fonctionnalités et ses développements restent la propriété du Concédant, sauf
          disposition écrite contraire.
        </p>
        <p>La souscription d&apos;une licence ne constitue pas :</p>
        <List
          items={[
            "une vente du logiciel ;",
            "une cession du code source ;",
            "une cession des droits de propriété intellectuelle ;",
            "une autorisation de créer des copies de SOLAL ;",
            "une autorisation de revendre SOLAL.",
          ]}
        />
        <p>
          Le Client conserve toutefois la propriété de ses propres éléments commerciaux,
          notamment :
        </p>
        <List
          items={[
            "son nom commercial ;",
            "son logo ;",
            "ses textes ;",
            "ses images ;",
            "ses produits ;",
            "ses données commerciales ;",
            "son nom de domaine.",
          ]}
        />
      </Section>

      <Section n={5} title="Utilisation autorisée">
        <p>Le Client peut utiliser SOLAL afin de :</p>
        <List
          items={[
            "présenter ses produits ;",
            "recevoir des commandes ;",
            "gérer ses produits ;",
            "gérer ses stocks ;",
            "gérer ses clients ;",
            "gérer ses commandes ;",
            "gérer ses moyens de paiement ;",
            "gérer ses paramètres de livraison ;",
            "administrer sa boutique.",
          ]}
        />
        <p>
          Le Client est responsable de l&apos;utilisation commerciale de sa boutique et du
          respect des lois et réglementations qui lui sont applicables.
        </p>
      </Section>

      <Section n={6} title="Utilisation interdite">
        <p>Il est interdit au Client de :</p>
        <List
          ordered
          items={[
            "copier le logiciel SOLAL ;",
            "revendre SOLAL à un tiers ;",
            "louer ou sous-licencier SOLAL ;",
            "distribuer le code source ;",
            "tenter d'obtenir le code source lorsqu'il n'est pas fourni ;",
            "désassembler ou décompiler SOLAL dans le but d'en reproduire le fonctionnement ;",
            "contourner les mécanismes de licence ;",
            "contourner une suspension ;",
            "utiliser une licence pour exploiter plusieurs boutiques lorsque la licence ne le permet pas ;",
            "permettre à un tiers d'utiliser sa licence pour exploiter une autre boutique ;",
            "supprimer ou modifier les mécanismes techniques permettant d'identifier la licence ;",
            "exploiter une faille de sécurité connue sans la signaler au Concédant ;",
            "utiliser SOLAL pour une activité illégale.",
          ]}
        />
      </Section>

      <Section n={7} title="Une licence = une boutique">
        <p>
          Sauf disposition commerciale contraire, une licence correspond à{" "}
          <strong>une boutique e-commerce</strong>.
        </p>
        <p>
          Le Client ne peut pas utiliser une licence pour créer ou exploiter plusieurs
          boutiques indépendantes.
        </p>
        <p>Exemple : une licence attribuée à Boutique A ne peut pas être utilisée pour créer simultanément Boutique A, Boutique B et Boutique C.</p>
        <p>Chaque boutique supplémentaire nécessite une licence distincte ou une offre spécifique.</p>
      </Section>

      <Section n={8} title="Domaine">
        <p>
          Le Client est propriétaire de son nom de domaine et en assume les frais
          d&apos;achat et de renouvellement.
        </p>
        <p>
          Le Client peut utiliser son propre domaine, par exemple :{" "}
          <span className="font-mono">www.maboutique.com</span>
        </p>
        <p>
          Le Concédant peut effectuer la configuration technique nécessaire afin de
          connecter le domaine à la boutique.
        </p>
        <p>Le Concédant n&apos;acquiert aucun droit de propriété sur le domaine du Client.</p>
        <p>
          Le renouvellement du domaine relève de la responsabilité du Client, sauf accord
          contraire écrit.
        </p>
      </Section>

      <Section n={9} title="Personnalisation de la boutique">
        <p>
          Selon la formule souscrite et les fonctionnalités disponibles, le Client peut
          personnaliser notamment :
        </p>
        <List
          items={[
            "le nom de la boutique ;",
            "le logo ;",
            "les couleurs ;",
            "les bannières ;",
            "les textes ;",
            "les coordonnées ;",
            "les moyens de paiement ;",
            "les frais de livraison.",
          ]}
        />
        <p>
          Certaines personnalisations ou modifications spécifiques peuvent être
          considérées comme des prestations supplémentaires.
        </p>
      </Section>

      <Section n={10} title="Configuration initiale">
        <p>La configuration initiale peut comprendre notamment :</p>
        <List
          items={[
            "création de la boutique ;",
            "configuration de l'identité commerciale ;",
            "configuration du domaine ;",
            "configuration initiale de l'administration ;",
            "configuration des moyens de paiement ;",
            "configuration des frais de livraison ;",
            "création des accès administrateur ;",
            "vérification du fonctionnement.",
          ]}
        />
        <p>
          Le délai annoncé de mise en ligne est de <strong>24 heures maximum</strong>, à
          compter de la réception de toutes les informations nécessaires fournies par le
          Client.
        </p>
        <p>
          Le délai peut être prolongé lorsque le Client ne fournit pas les informations,
          contenus, accès ou éléments nécessaires.
        </p>
      </Section>

      <PricingSection
        n={11}
        title="Formule mensuelle"
        applicable={boutique.licenseType === "MONTHLY"}
      >
        <p>La formule mensuelle est souscrite pour une période d&apos;un mois renouvelable.</p>
        <p>Le Client règle : frais d&apos;installation {money(LICENSE_PRICING.MONTHLY.installationFee)}, puis licence {money(LICENSE_PRICING.MONTHLY.recurringFee)} par mois.</p>
        <p>La licence reste active tant que les paiements requis sont effectués.</p>
      </PricingSection>

      <PricingSection
        n={12}
        title="Formule annuelle"
        applicable={boutique.licenseType === "YEARLY"}
      >
        <p>La formule annuelle est souscrite pour une période de douze mois.</p>
        <p>Le Client règle : frais d&apos;installation {money(LICENSE_PRICING.YEARLY.installationFee)}, puis licence {money(LICENSE_PRICING.YEARLY.recurringFee)} par an.</p>
        <p>La licence est valable pendant la période annuelle souscrite.</p>
      </PricingSection>

      <PricingSection
        n={13}
        title="Licence définitive"
        applicable={boutique.licenseType === "PERPETUAL"}
      >
        <p>
          Frais d&apos;installation {money(LICENSE_PRICING.PERPETUAL.installationFee)},
          licence {money(LICENSE_PRICING.PERPETUAL.recurringFee)}, total initial{" "}
          {money(
            LICENSE_PRICING.PERPETUAL.installationFee + LICENSE_PRICING.PERPETUAL.recurringFee,
          )}
          .
        </p>
        <p>
          Cette licence accorde au Client un droit d&apos;utilisation permanent de la
          Boutique concernée.
        </p>
        <p>La licence définitive ne constitue pas une cession du logiciel SOLAL.</p>
        <p>Le code source et les droits de propriété intellectuelle restent la propriété du Concédant.</p>
      </PricingSection>

      <Section n={14} title="Mises à jour">
        <p>Les mises à jour courantes peuvent être incluses dans les formules d&apos;abonnement.</p>
        <p>
          Les mises à jour majeures ou nouvelles versions importantes peuvent être
          facturées séparément pour les licences définitives.
        </p>
        <p>Une mise à jour majeure peut notamment correspondre à :</p>
        <List
          items={[
            "une refonte importante de l'architecture ;",
            "une nouvelle version majeure du logiciel ;",
            "une nouvelle génération de fonctionnalités ;",
            "une modification substantielle de la plateforme.",
          ]}
        />
        <p>Le Concédant peut définir les modalités et tarifs applicables aux mises à jour majeures.</p>
      </Section>

      <Section n={15} title="Fonctionnalités et options">
        <p>Certaines fonctionnalités peuvent être activées ou désactivées selon :</p>
        <List
          items={[
            "la formule ;",
            "la licence ;",
            "les besoins du Client ;",
            "les options souscrites ;",
            "les conditions commerciales.",
          ]}
        />
        <p>Le Concédant peut proposer de nouvelles fonctionnalités sous forme d&apos;options payantes.</p>
      </Section>

      <Section n={16} title="Services supplémentaires">
        <p>Les services suivants ne sont pas nécessairement inclus dans la licence :</p>
        <List
          items={[
            "ajout massif de produits ;",
            "création de visuels ;",
            "modifications spécifiques du design ;",
            "développement de fonctionnalités personnalisées ;",
            "migration de données ;",
            "intégrations spécifiques ;",
            "développements sur mesure.",
          ]}
        />
        <p>Ces services peuvent faire l&apos;objet d&apos;un devis séparé.</p>
        <p>Aucun développement spécifique n&apos;est considéré comme inclus dans la licence sans accord écrit.</p>
      </Section>

      <Section n={17} title="Support">
        <p>Le support inclus comprend notamment :</p>
        <List
          items={[
            "assistance technique ;",
            "aide à l'utilisation de l'administration ;",
            "aide à résoudre les problèmes ;",
            "accompagnement initial ;",
            "configuration initiale.",
          ]}
        />
        <p>Le support ne comprend pas automatiquement :</p>
        <List
          items={[
            "la gestion quotidienne de la boutique ;",
            "la saisie des produits ;",
            "la création de contenu ;",
            "la création graphique ;",
            "le développement sur mesure ;",
            "la gestion commerciale du Client.",
          ]}
        />
      </Section>

      <Section n={18} title="Données du Client">
        <p>Le Client conserve ses droits sur ses données commerciales.</p>
        <p>Ces données peuvent notamment comprendre :</p>
        <List
          items={[
            "produits ;",
            "prix ;",
            "stocks ;",
            "commandes ;",
            "clients ;",
            "informations de livraison ;",
            "contenus ;",
            "paramètres de boutique.",
          ]}
        />
        <p>
          Le Concédant doit mettre en œuvre des mesures raisonnables destinées à protéger
          les données contre les accès non autorisés.
        </p>
        <p>
          Le Client reste responsable de la légalité et de l&apos;exactitude des données
          qu&apos;il introduit dans la plateforme.
        </p>
      </Section>

      <Section n={19} title="Données personnelles">
        <p>
          Lorsque la boutique permet de collecter des données personnelles de clients
          finaux, le Client est responsable de l&apos;utilisation de ces données dans le
          cadre de son activité.
        </p>
        <p>
          Le Client doit notamment veiller à respecter les obligations légales
          applicables à la collecte, au traitement, à la conservation et à
          l&apos;utilisation des données personnelles.
        </p>
        <p>
          Les responsabilités respectives du Client et du Concédant peuvent être
          précisées dans une politique de confidentialité ou un accord spécifique
          lorsque cela est nécessaire.
        </p>
      </Section>

      <Section n={20} title="Sécurité">
        <p>Le Client s&apos;engage à :</p>
        <List
          items={[
            "conserver ses identifiants confidentiels ;",
            "ne pas partager son compte administrateur ;",
            "utiliser des mots de passe suffisamment sécurisés ;",
            "signaler toute activité suspecte ;",
            "signaler toute vulnérabilité découverte.",
          ]}
        />
        <p>Le Client ne doit pas tenter de contourner les mécanismes de sécurité de SOLAL.</p>
        <p>
          Toute tentative d&apos;accès non autorisé à une autre boutique ou aux systèmes
          internes peut entraîner la suspension de la licence.
        </p>
      </Section>

      <Section n={21} title="Suspension">
        <p>
          Pour les licences mensuelles et annuelles, le Concédant peut suspendre la
          boutique lorsque :
        </p>
        <List
          items={[
            "la licence arrive à expiration ;",
            "un paiement dû n'est pas réglé ;",
            "le Client utilise la plateforme en violation substantielle des présentes conditions ;",
            "une activité illégale est constatée ou raisonnablement suspectée ;",
            "une utilisation présente un risque important pour la sécurité de la plateforme.",
          ]}
        />
        <p>Lorsque cela est raisonnablement possible, le Client peut être informé avant la suspension.</p>
      </Section>

      <Section n={22} title="Période de grâce">
        <p>Le Concédant peut prévoir une période de grâce après l&apos;échéance d&apos;un paiement.</p>
        <p>Pendant cette période, la boutique peut rester temporairement accessible.</p>
        <p>À l&apos;issue de la période de grâce, la boutique peut être suspendue jusqu&apos;à régularisation.</p>
        <p>La durée de la période de grâce peut être précisée dans l&apos;offre commerciale ou le contrat.</p>
      </Section>

      <Section n={23} title="Réactivation">
        <p>
          Une boutique suspendue pour défaut de paiement peut être réactivée après
          régularisation des sommes dues.
        </p>
        <p>Les conditions de réactivation peuvent dépendre de la durée de suspension.</p>
      </Section>

      <Section n={24} title="Résiliation par le Client">
        <p>Pour une licence mensuelle, le Client peut demander la résiliation avant le prochain renouvellement.</p>
        <p>Pour une licence annuelle, les conditions de résiliation sont celles prévues dans le contrat ou l&apos;offre souscrite.</p>
        <p>
          La licence définitive ne peut pas être résiliée comme un abonnement récurrent
          puisqu&apos;elle correspond à un droit d&apos;utilisation permanent.
        </p>
        <p>Les prestations déjà réalisées peuvent rester dues.</p>
      </Section>

      <Section n={25} title="Résiliation pour violation">
        <p>
          Le Concédant peut mettre fin au droit d&apos;utilisation du Client en cas de
          violation grave des présentes conditions.
        </p>
        <p>Sont notamment considérées comme graves :</p>
        <List
          items={[
            "tentative de piratage ;",
            "accès à une autre boutique ;",
            "extraction ou copie du logiciel ;",
            "revente non autorisée ;",
            "contournement volontaire du système de licence ;",
            "utilisation frauduleuse ;",
            "utilisation illégale de la plateforme.",
          ]}
        />
      </Section>

      <Section n={26} title="Limitation du droit de licence définitive">
        <p>Même après acquisition d&apos;une licence définitive, le Client ne peut pas :</p>
        <List
          items={[
            "revendre SOLAL ;",
            "revendre le code ;",
            "distribuer la plateforme ;",
            "créer des copies commerciales ;",
            "fournir la plateforme à des tiers ;",
            "utiliser une seule licence pour plusieurs boutiques indépendantes.",
          ]}
        />
        <p>La licence définitive reste limitée à la Boutique définie lors de son acquisition.</p>
      </Section>

      <Section n={27} title="Disponibilité du service">
        <p>Le Concédant met en œuvre des moyens raisonnables pour maintenir le service disponible.</p>
        <p>Toutefois, une disponibilité permanente et sans interruption ne peut être garantie.</p>
        <p>Des interruptions peuvent notamment résulter :</p>
        <List
          items={[
            "de maintenance ;",
            "de mises à jour ;",
            "de problèmes d'hébergement ;",
            "de problèmes liés aux fournisseurs tiers ;",
            "de problèmes de réseau ;",
            "d'événements indépendants du contrôle du Concédant.",
          ]}
        />
      </Section>

      <Section n={28} title="Fournisseurs tiers">
        <p>SOLAL peut dépendre de services tiers, notamment :</p>
        <List
          items={[
            "hébergement ;",
            "base de données ;",
            "services de domaine ;",
            "services de paiement ;",
            "services de stockage ;",
            "services de messagerie.",
          ]}
        />
        <p>
          Les interruptions ou modifications de services tiers peuvent affecter certaines
          fonctionnalités de la boutique.
        </p>
      </Section>

      <Section n={29} title="Responsabilité du Client">
        <p>Le Client est responsable :</p>
        <List
          items={[
            "de ses produits ;",
            "de ses prix ;",
            "de ses commandes ;",
            "de ses clients ;",
            "de ses contenus ;",
            "de ses conditions commerciales ;",
            "de ses obligations fiscales et légales ;",
            "de ses moyens de paiement ;",
            "de son activité commerciale.",
          ]}
        />
        <p>SOLAL fournit l&apos;infrastructure technique et ne devient pas vendeur des produits proposés par le Client.</p>
      </Section>

      <Section n={30} title="Activités interdites">
        <p>Le Client ne doit pas utiliser SOLAL pour :</p>
        <List
          items={[
            "une activité illégale ;",
            "une fraude ;",
            "une escroquerie ;",
            "la distribution de contenus interdits ;",
            "le phishing ;",
            "la diffusion de logiciels malveillants ;",
            "l'usurpation d'identité ;",
            "toute activité portant atteinte aux droits d'un tiers.",
          ]}
        />
      </Section>

      <Section n={31} title="Modification des conditions">
        <p>Le Concédant peut faire évoluer les présentes conditions afin de tenir compte :</p>
        <List
          items={[
            "de l'évolution de la plateforme ;",
            "de nouvelles fonctionnalités ;",
            "d'évolutions légales ;",
            "de changements techniques ;",
            "de nouvelles offres commerciales.",
          ]}
        />
        <p>Les modifications importantes doivent être communiquées au Client dans des conditions raisonnables.</p>
      </Section>

      <Section n={32} title="Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit applicable convenu entre les
          parties dans le contrat de licence.
        </p>
        <p>
          Pour une commercialisation en Mauritanie, les parties peuvent prévoir
          expressément le droit mauritanien et la juridiction compétente, sous réserve
          des règles impératives applicables.
        </p>
      </Section>

      <Section n={33} title="Acceptation">
        <p>
          La souscription d&apos;une licence SOLAL implique que le Client reconnaît avoir
          pris connaissance des présentes Conditions de Licence et les accepter.
        </p>
        <p>Le contrat ou bon de commande signé par les parties peut compléter ou préciser les présentes conditions.</p>
      </Section>

      <Section n={34} title="Informations contractuelles">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
          <Row label="Concédant" value="SOLAL" />
          <Row label="Adresse" value={placeholder(solalContact.address)} />
          <Row label="Téléphone" value={placeholder(solalContact.phone)} />
          <Row label="Email" value={placeholder(solalContact.email)} />
          <Row label="Site web" value={placeholder(solalContact.website)} />
          <Row label="Client" value={placeholder(boutique.licenseClientName)} />
          <Row label="Boutique" value={boutique.label} />
          <Row label="Domaine" value={boutique.domain ?? "[à compléter]"} />
          <Row label="Type de licence" value={LICENSE_TYPE_LABEL[boutique.licenseType]} />
          <Row label="Date de début" value={formatDate(boutique.licenseStartedAt ?? null)} />
          <Row
            label="Date d'expiration"
            value={
              boutique.licenseType === "PERPETUAL"
                ? "Sans expiration (licence définitive)"
                : formatDate(boutique.licenseExpiresAt)
            }
          />
          <Row label="Statut actuel" value={effectiveState} />
        </dl>
      </Section>

      <section className="flex flex-col gap-4 border-t pt-6">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide">Signatures</h2>
        <div className="grid grid-cols-2 gap-8 pt-4 text-sm">
          <SignatureBlock role="Le Concédant" />
          <SignatureBlock role="Le Client" />
        </div>
      </section>

      <footer className="border-t pt-4 text-center text-xs text-muted-foreground italic">
        SOLAL — Votre boutique. Votre marque. Votre gestion.
      </footer>
    </article>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 print:break-inside-avoid">
      <h2 className="text-sm font-bold">
        {n}. {title.toUpperCase()}
      </h2>
      {children}
    </section>
  );
}

function PricingSection({
  n,
  title,
  applicable,
  children,
}: {
  n: number;
  title: string;
  applicable: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-md p-3 print:break-inside-avoid ${
        applicable ? "border border-primary bg-primary/5" : "border border-transparent"
      }`}
    >
      <h2 className="text-sm font-bold">
        {n}. {title.toUpperCase()}
        {applicable && (
          <span className="ms-2 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            Applicable à ce contrat
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-decimal ps-5" : "list-disc ps-5"}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{term}</dt>
      <dd className="ps-4">{children}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-semibold">{label} :</dt>
      <dd>{value}</dd>
    </>
  );
}

function SignatureBlock({ role }: { role: string }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="font-semibold">{role}</p>
      <p>Nom : ________________________</p>
      <p>Signature : ____________________</p>
      <p>Date : _________________________</p>
    </div>
  );
}
