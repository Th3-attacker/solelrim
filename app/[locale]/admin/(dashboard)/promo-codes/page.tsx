import { getTranslations, getFormatter } from "next-intl/server";
import { Pencil, Plus, Ticket } from "@phosphor-icons/react/dist/ssr";
import { getAllPromoCodes } from "@/lib/queries/promo-codes";
import { getAllClients } from "@/lib/queries/clients";
import { getAdminScope } from "@/lib/shop/admin-scope";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateMessage } from "@/components/ui/state-message";
import { PromoCodeFormDialog } from "@/components/settings/promo-code-form-dialog";
import { DeactivatePromoCodeButton } from "@/components/settings/deactivate-promo-code-button";
import { formatPrice } from "@/lib/format/currency";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PromoCodesPage() {
  const scope = await getAdminScope();
  const [t, tCommon, format, promoCodes, clients] = await Promise.all([
    getTranslations("promoCodes"),
    getTranslations("common"),
    getFormatter(),
    getAllPromoCodes(scope),
    getAllClients(scope),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <PromoCodeFormDialog
          clients={clients}
          trigger={
            <Button type="button">
              <Plus className="size-4" />
              {t("newCode")}
            </Button>
          }
        />
      </div>

      {promoCodes.length === 0 ? (
        <StateMessage icon={Ticket} title={t("noPromoCodes")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("discountValue")}</TableHead>
              <TableHead>{t("client")}</TableHead>
              <TableHead>{t("usage")}</TableHead>
              <TableHead>{t("expiresAt")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-end">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoCodes.map((promoCode) => (
              <TableRow key={promoCode.id}>
                <TableCell className="font-mono font-medium">{promoCode.code}</TableCell>
                <TableCell>
                  {promoCode.discountType === "PERCENT"
                    ? `-${promoCode.discountValue.toNumber()}%`
                    : `-${formatPrice(promoCode.discountValue, tCommon("currency"))}`}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {promoCode.client?.fullName ?? t("generalCode")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {promoCode.usedCount}
                  {promoCode.maxUses !== null ? ` / ${promoCode.maxUses}` : ` (${t("unlimited")})`}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {promoCode.expiresAt
                    ? format.dateTime(promoCode.expiresAt, { dateStyle: "medium" })
                    : t("noExpiration")}
                </TableCell>
                <TableCell>
                  <Badge variant={promoCode.isActive ? "secondary" : "outline"}>
                    {promoCode.isActive ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <PromoCodeFormDialog
                    clients={clients}
                    promoCode={{
                      id: promoCode.id,
                      code: promoCode.code,
                      discountType: promoCode.discountType,
                      discountValue: promoCode.discountValue.toNumber(),
                      clientId: promoCode.clientId,
                      expiresAt: promoCode.expiresAt
                        ? promoCode.expiresAt.toISOString().slice(0, 10)
                        : null,
                      maxUses: promoCode.maxUses,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={t("editCode")}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  {promoCode.isActive && (
                    <DeactivatePromoCodeButton promoCodeId={promoCode.id} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
