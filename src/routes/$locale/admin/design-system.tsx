import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTable, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import { z } from "zod";
import { AppShell } from "~/components/layout/app-shell";
import { useAppForm } from "~/components/form/form";
import { Button, IconButton } from "~/components/ui/button";
import { Card, CardHeader } from "~/components/ui/card";
import { ConfirmDialog, Dialog, Sheet } from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Choice,
  Field,
  Input,
  Segmented,
  Select,
  Stepper,
  Switch,
  Textarea,
} from "~/components/ui/field";
import { Icon } from "~/components/ui/icon";
import { Menu, MenuItem, MenuSeparator } from "~/components/ui/menu";
import { PageHeader } from "~/components/ui/page-header";
import { Skeleton } from "~/components/ui/skeleton";
import { CountBadge, Status, type StatusTone } from "~/components/ui/status";
import { notify } from "~/components/ui/toast";
import { InfoTip } from "~/components/ui/tooltip";
import {
  DataTable,
  Pagination,
  adminColumns,
  adminTableFeatures,
  selectionColumn,
} from "~/components/table/data-table";
import { shellQuery } from "~/features/shell/shell.queries";
import { Checkout } from "~/features/pos/checkout";

// The design's "Composants" board, built from the real components inside the
// real frame, to review them in both themes and three languages. Development
// only, with made-up data: never served in production.
export const Route = createFileRoute("/$locale/admin/design-system")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  staticData: { section: "admin.nav.overviewGroup", title: "nav.dashboard" },
  component: DesignSystemPage,
});

// The frame's data, made up, in a query cache of its own so it never mixes
// with a real session's.
function fixtureClient() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(shellQuery.queryKey, {
    admin: { email: "elhadj@solal-rim.com", name: "Elhadj", role: "SUPERADMIN" },
    boutique: { key: "sport", label: "Sport", domain: "solal-rim.com" },
    boutiques: [
      { key: "sport", label: "Sport", domain: "solal-rim.com" },
      { key: "cosmetique", label: "Cosmétique", domain: null },
    ],
    siteUrl: "https://solal-rim.com",
    counts: { pendingOrders: 17, pendingRefunds: 2 },
  });
  return client;
}

function DesignSystemPage() {
  const { locale } = Route.useRouteContext();
  const [client] = useState(fixtureClient);
  return (
    <QueryClientProvider client={client}>
      <AppShell locale={locale}>
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-7 pb-14 md:px-8">
          <PageHeader
            title="Composants"
            description="Bibliothèque de l'administration, en clair et en sombre."
            actions={<Button variant="primary">Action principale</Button>}
          />
          <Buttons />
          <Statuses />
          <Fields />
          <FormDemo />
          <Menus />
          <Cards />
          <Overlays />
          <TableDemo />
          <CheckoutDemo locale={locale} />
        </div>
      </AppShell>
    </QueryClientProvider>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" aria-label={title} className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.2px]">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

const row = "flex flex-wrap items-center gap-3";
const label = "text-label text-muted uppercase";

function Buttons() {
  return (
    <Section
      title="Boutons"
      hint="Un seul bouton principal par écran. Hauteur 40, ou 48 dans les formulaires et la caisse."
    >
      <p className={label}>Variantes</p>
      <div className={row}>
        <Button variant="primary">Confirmer le paiement</Button>
        <Button>Exporter CSV</Button>
        <Button variant="quiet">Tout voir</Button>
        <Button variant="danger">Oui, supprimer</Button>
      </div>
      <p className={label}>Avec icône · icône seule</p>
      <div className={row}>
        <Button variant="primary">
          <Icon name="plus" />
          Nouveau produit
        </Button>
        <Button>
          <Icon name="download" />
          Exporter
        </Button>
        <IconButton label="Modifier">
          <Icon name="edit" />
        </IconButton>
        <IconButton label="Supprimer" variant="quiet" className="text-muted">
          <Icon name="trash" />
        </IconButton>
      </div>
      <p className={label}>États</p>
      <div className={row}>
        <Button variant="primary" disabled>
          Désactivé
        </Button>
        <Button variant="primary" busy>
          Envoi…
        </Button>
        <Button variant="primary" size="lg">
          Grand · 48
        </Button>
        <Button size="sm">Petit · 32</Button>
      </div>
    </Section>
  );
}

const STATUSES: Array<[StatusTone, string]> = [
  ["pend", "En attente"],
  ["conf", "Confirmée"],
  ["ship", "En livraison"],
  ["ok", "Livrée"],
  ["bad", "Refusée"],
  ["warn", "Plus que 2"],
  ["mute", "Fermée"],
];

function Statuses() {
  return (
    <Section title="Statuts et badges" hint="Point + mot, jamais la couleur seule.">
      <div className={row}>
        {STATUSES.map(([tone, text]) => (
          <Status key={tone} tone={tone}>
            {text}
          </Status>
        ))}
        <CountBadge count={17} label="17 commandes à vérifier" />
      </div>
      <div className={row}>
        <span className="text-[13px] text-muted">Écart = compté − attendu</span>
        <InfoTip>
          L’écart est la différence entre les espèces comptées et le montant attendu.
        </InfoTip>
      </div>
    </Section>
  );
}

function Fields() {
  const [on, setOn] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [quantity, setQuantity] = useState(2);
  return (
    <Section
      title="Formulaires"
      hint="Libellé au-dessus, aide en dessous, l'erreur dit quoi faire."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Au repos">
          {(control) => <Input {...control} placeholder="Ex. Pullover" />}
        </Field>
        <Field label="Erreur" error="8 chiffres, commençant par 2, 3 ou 4.">
          {(control) => <Input {...control} defaultValue="2233" inputMode="tel" dir="ltr" />}
        </Field>
        <Field label="Désactivé" hint="Illimité pour cette offre.">
          {(control) => <Input {...control} defaultValue="∞" disabled />}
        </Field>
        <Field label="Avec unité">
          {(control) => <Input {...control} leading="MRU" defaultValue="570" inputMode="numeric" />}
        </Field>
        <Field label="Catégorie">
          {(control) => (
            <Select {...control} defaultValue="casual">
              <option value="casual">Casual</option>
              <option value="shoes">Chaussures</option>
            </Select>
          )}
        </Field>
        <Field label="Zone de texte">
          {(control) => <Textarea {...control} placeholder="Instructions de paiement" />}
        </Field>
      </div>
      <p className={label}>Choix</p>
      <div className={row}>
        <Choice label="Case cochée" defaultChecked />
        <Choice type="radio" name="demo-radio" label="Option A" defaultChecked />
        <Choice type="radio" name="demo-radio" label="Option B" />
        <Switch checked={on} onCheckedChange={setOn} label="Interrupteur" />
        <Segmented
          label="Période"
          name="demo-period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "day", label: "Jour" },
            { value: "week", label: "Semaine" },
            { value: "month", label: "Mois" },
          ]}
        />
        <Stepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          label="Quantité"
          decreaseLabel="Moins"
          increaseLabel="Plus"
        />
      </div>
    </Section>
  );
}

const sellerSchema = z.object({
  email: z.email({ error: "invalidEmail" }),
  name: z.string().trim().min(1, { error: "required" }),
});

function FormDemo() {
  const form = useAppForm({
    defaultValues: { email: "", name: "" },
    validators: { onSubmit: sellerSchema },
    onSubmit: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      notify({ title: "Vendeur créé.", description: value.email });
    },
  });
  return (
    <Section
      title="Formulaire relié"
      hint="TanStack Form et le schéma zod partagé avec le serveur."
    >
      <form
        noValidate
        className="grid max-w-md gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => <field.TextField label="Nom" required />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Adresse e-mail"
              type="email"
              dir="ltr"
              autoComplete="off"
              hint="Le vendeur le change à sa première connexion."
              required
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton label="Créer le vendeur" />
        </form.AppForm>
      </form>
    </Section>
  );
}

function Menus() {
  return (
    <Section title="Menus déroulants" hint="Le danger est toujours en dernier, séparé.">
      <div className={row}>
        <Menu
          trigger={
            <Button>
              Actions
              <Icon name="chevronDown" className="size-4 text-muted" />
            </Button>
          }
        >
          <MenuItem shortcut="E" onClick={() => notify({ title: "Modifier", tone: "info" })}>
            Modifier
          </MenuItem>
          <MenuItem onClick={() => notify({ title: "Dupliqué." })}>Dupliquer</MenuItem>
          <MenuItem shortcut="P" onClick={() => notify({ title: "Étiquette imprimée." })}>
            Imprimer l’étiquette
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onClick={() => notify({ title: "Supprimer ?", tone: "error" })}>
            Supprimer
          </MenuItem>
        </Menu>
      </div>
    </Section>
  );
}

function Cards() {
  return (
    <Section
      title="Cartes"
      hint="Bordure fine, pas d'ombre au repos. L'ombre est réservée à ce qui flotte."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-[13px] text-muted">Chiffre d’affaires · octobre</p>
          <p className="mt-1 text-page-title text-brand">
            14.920 <span className="text-[14px] font-normal text-muted">MRU</span>
          </p>
          <p className="text-[12px] text-muted">
            <b className="text-ok-ink">↑ 157,2 %</b> vs septembre
          </p>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </Card>
        <Card>
          <EmptyState
            icon="promo"
            title="Aucun code promo"
            description="Créez-en un en 30 secondes."
            action={<Button>Nouveau code</Button>}
          />
        </Card>
      </div>
    </Section>
  );
}

function Overlays() {
  const [sheet, setSheet] = useState(false);
  return (
    <Section
      title="Fenêtres et notifications"
      hint="Confirmation avant une action définitive, verbe d'action sur le bouton. Les notifications partent seules après 5 secondes."
    >
      <div className={row}>
        <ConfirmDialog
          trigger={<Button variant="danger">Supprimer « Pullover »</Button>}
          title="Supprimer « Pullover » ?"
          description="Le produit disparaît du site, de l'app et de la caisse. Les ventes passées restent dans l'historique."
          cancelLabel="Revenir"
          confirmLabel="Oui, supprimer"
          onConfirm={() =>
            notify({ title: "Produit supprimé.", action: { label: "Annuler", onClick: () => {} } })
          }
        />
        <Dialog
          trigger={<Button>Nouveau vendeur</Button>}
          title="Nouveau vendeur"
          description="Accès caisse uniquement · 1 place restante sur 2"
          closeLabel="Fermer"
          footer={<Button variant="primary">Créer le vendeur</Button>}
        >
          <Field label="Adresse e-mail">
            {(control) => (
              <Input {...control} type="email" dir="ltr" placeholder="caisse2@solal.com" />
            )}
          </Field>
        </Dialog>
        <Button onClick={() => setSheet(true)}>Panneau du bas</Button>
        <Button
          onClick={() =>
            notify({
              title: "Paiement confirmé.",
              description: "Le client est prévenu sur WhatsApp.",
            })
          }
        >
          Notification
        </Button>
        <Button
          onClick={() =>
            notify({
              title: "Envoi impossible",
              description: "Vérifiez la connexion puis réessayez.",
              tone: "error",
            })
          }
        >
          Erreur
        </Button>
      </div>
      <Sheet open={sheet} onOpenChange={setSheet} side="bottom" title="Confirmer la vente">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-ink-2">Total à encaisser : 1.140 MRU.</p>
          <Button variant="primary" size="lg" onClick={() => setSheet(false)}>
            Encaisser
          </Button>
        </div>
      </Sheet>
    </Section>
  );
}

type Order = { id: string; ref: string; client: string; total: number; status: StatusTone };

const ORDERS: Order[] = [
  { id: "1", ref: "CMD-P7YRQNMP", client: "Oumar Diallo", total: 1140, status: "pend" },
  { id: "2", ref: "CMD-WQW5YN8R", client: "Fatimetou Cheikh", total: 900, status: "conf" },
  { id: "3", ref: "CMD-E23PWR43", client: "Aïcha Diop", total: 2750, status: "ship" },
  { id: "4", ref: "CMD-6SJRTZSW", client: "Brahim Vall", total: 5400, status: "ok" },
];
const STATUS_TEXT: Partial<Record<StatusTone, string>> = {
  pend: "En attente",
  conf: "Confirmée",
  ship: "En livraison",
  ok: "Livrée",
};
const mru = (value: number) => `${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} MRU`;

const helper = adminColumns<Order>();
const columns = helper.columns([
  selectionColumn<Order>({
    selectAllLabel: "Tout sélectionner sur cette page",
    rowLabel: (order) => `Sélectionner ${order.ref}`,
  }),
  helper.accessor("ref", { header: "Référence", meta: { rowHeader: true }, enableSorting: false }),
  helper.accessor("client", { header: "Client" }),
  helper.accessor("total", {
    header: "Total",
    meta: { align: "end" },
    cell: ({ getValue }) => <b className="font-semibold">{mru(getValue())}</b>,
  }),
  helper.accessor("status", {
    header: "Statut",
    enableSorting: false,
    cell: ({ getValue }) => <Status tone={getValue()}>{STATUS_TEXT[getValue()]}</Status>,
  }),
]);

function TableDemo() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [page, setPage] = useState(1);
  // The server sorts the real lists; here the made-up rows sort in place.
  const data = useMemo(() => {
    const [sort] = sorting;
    if (!sort) return ORDERS;
    const key = sort.id as "client" | "total";
    return [...ORDERS].sort((a, b) => (a[key] > b[key] ? 1 : -1) * (sort.desc ? -1 : 1));
  }, [sorting]);

  const table = useTable({
    features: adminTableFeatures,
    columns,
    data,
    getRowId: (order) => order.id,
    manualSorting: true,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
  });

  return (
    <Card as="section" aria-label="Tableau" className="overflow-hidden">
      <CardHeader title="Tableau" />
      <DataTable
        table={table}
        caption="Commandes (exemple)"
        selectionBar={(selected) => (
          <>
            <b>{selected.length} sélectionnée(s)</b>
            <span className="flex-1" />
            <Button size="sm" variant="secondary" onClick={() => setRowSelection({})}>
              Annuler
            </Button>
          </>
        )}
      />
      <Pagination
        page={page}
        pageSize={20}
        total={28}
        rangeLabel={({ from, to, total }) => `${from}–${to} sur ${total}`}
        previousLabel="Précédent"
        nextLabel="Suivant"
        onPageChange={setPage}
      />
    </Card>
  );
}

// The checkout with made-up products, at a desktop screen's height.
const DEMO_CHECKOUT = {
  open: true as const,
  session: { id: "demo", openingFloat: 900, openedAt: new Date("2026-10-14T09:00:00Z") },
  products: [
    ["p1", "Casquette", "Casual", 150, 4],
    ["p2", "Chaussettes", "Chaussettes", 50, 12],
    ["p3", "Fitbit", "Accessoires", 900, 0],
    ["p4", "Pullover", "Casual", 570, 3],
  ].map(([id, name, category, price, stock]) => ({
    id: String(id),
    name: String(name),
    category: String(category),
    imageUrl: null,
    variants: [
      {
        id: `${id}-v`,
        size: "M",
        color: "Noir",
        sku: `SKU-${id}`,
        stock: Number(stock),
        price: Number(price),
      },
    ],
  })),
  wallets: ["Bankily", "Masrvi", "Sedad", "Bimbank"].map((provider, index) => ({
    id: `w${index}`,
    provider,
    number: "",
  })),
  loyaltyRule: { enabled: true, spendPerPoint: 100, rewardPoints: 100, rewardValue: 1000 },
};

function CheckoutDemo({ locale }: { locale: "fr" | "en" | "ar" }) {
  return (
    <Section
      title="Caisse"
      hint="L'écran de vente, avec des articles inventés (aucune vente n'est envoyée sans clic sur Encaisser)."
    >
      <div
        className="flex h-[836px] flex-col overflow-hidden rounded-card border border-line"
        data-testid="checkout-demo"
      >
        <Checkout data={DEMO_CHECKOUT} locale={locale} />
      </div>
    </Section>
  );
}
