import { createSerializationAdapter } from "@tanstack/react-router";
import { Prisma } from "@/lib/generated/prisma/browser";

// Les montants Prisma (Decimal) traversent tels quels du serveur vers le
// navigateur : les composants appellent .toNumber() dessus, comme lorsqu'ils
// étaient rendus côté serveur par Next.js.
export const decimalSerializationAdapter = createSerializationAdapter({
  key: "prisma-decimal",
  test: (value): value is InstanceType<typeof Prisma.Decimal> => Prisma.Decimal.isDecimal(value),
  toSerializable: (value) => value.toString(),
  fromSerializable: (value: string) => new Prisma.Decimal(value),
});
