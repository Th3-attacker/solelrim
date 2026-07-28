"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createClientRecord, updateClientRecord } from "@/lib/actions/clients";
import { clientSchema, type ClientInput } from "@/lib/validation/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "@/components/ui/toast";

export function ClientForm({
  defaultValues,
  clientId,
}: {
  defaultValues?: ClientInput;
  clientId?: string;
}) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValues ?? {
      fullName: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    },
  });

  const onSubmit: SubmitHandler<ClientInput> = async (data) => {
    setSubmitting(true);
    const result = clientId
      ? await updateClientRecord(clientId, data)
      : await createClientRecord(data);
    setSubmitting(false);

    if (result.error) {
      toast.error(tCommon("error"));
      return;
    }

    router.push(`/admin/clients/${result.clientId}`);
    router.refresh();
    toast.success(tCommon("save"));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && (
              <p className="text-sm text-destructive">
                {tCommon("requiredField")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              {...register("phone")}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(
                  /\D/g,
                  "",
                );
              }}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">
                {tCommon("invalidPhone")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">
                {tCommon("requiredField")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" {...register("address")} />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={submitting}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
