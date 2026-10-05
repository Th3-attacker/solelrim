import { z } from "zod";

// What the Expo push service hands the app: ExponentPushToken[xxxx] (the
// older ExpoPushToken[...] spelling still exists).
export const expoPushTokenSchema = z
  .string()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/);

// The same credentials as tracking an order — there are no accounts.
export const pushRegistrationSchema = z.object({
  phone: z.string().regex(/^[234]\d{7}$/),
  reference: z.string().trim().min(1),
  token: expoPushTokenSchema,
});
