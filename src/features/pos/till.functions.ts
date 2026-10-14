import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getDayView,
  getOpenSession,
  getSessionView,
  listDayClosures,
  listSessions,
  SESSIONS_PAGE_SIZE,
} from "@/lib/queries/cash-sessions";
import { businessDateOf, parseBusinessDate } from "@/lib/shop/cash";
import {
  addCashMovementCommand,
  closeCashSessionCommand,
  closeStoreDayCommand,
  openCashSessionCommand,
} from "@/lib/services/cash-sessions-commands";
import {
  adminMiddleware,
  staffMiddleware,
  writableAdminMiddleware,
  writableStaffMiddleware,
} from "~/server/admin-middleware";

// The till: opening it with a float, money in and out, closing it against
// the cash counted; the tills' history, and the boutique's end-of-day
// closure. A seller sees and closes only their own; an admin every till of
// the boutique. The rules themselves are the shared commands'.

export const openTill = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => openCashSessionCommand(command, data));

export const addTillMovement = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => addCashMovementCommand(command, data));

export const closeTill = createServerFn({ method: "POST" })
  .middleware([writableStaffMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => closeCashSessionCommand(command, data));

// The caller's own open till, with its live figures. Null once closed.
export const getMyTill = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .handler(async ({ context: { admin, productType } }) => {
    const open = await getOpenSession(admin.id, productType);
    return open ? getSessionView(open.id, productType, admin) : null;
  });

export const getTill = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(z.object({ sessionId: z.string().min(1).max(64) }))
  .handler(async ({ context: { admin, productType }, data }) => {
    const session = await getSessionView(data.sessionId, productType, admin);
    // Who may close it from here: its own seller, or any admin.
    return (
      session && { ...session, closable: admin.role !== "SELLER" || session.sellerId === admin.id }
    );
  });

export const listTills = createServerFn({ method: "GET" })
  .middleware([staffMiddleware])
  .validator(z.object({ page: z.number().int().min(1).max(10_000) }))
  .handler(async ({ context: { admin, productType }, data }) => ({
    ...(await listSessions(productType, admin, data.page)),
    pageSize: SESSIONS_PAGE_SIZE,
  }));

// One business day (today by default), and the last closures.
export const getClosures = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ context: { productType }, data }) => {
    const today = businessDateOf(new Date());
    const asked = data.date ? parseBusinessDate(data.date) : null;
    const date = asked && asked <= today ? asked : today;
    const [day, closures] = await Promise.all([
      getDayView(productType, date),
      listDayClosures(productType),
    ]);
    return {
      date: date.toISOString().slice(0, 10),
      today: today.toISOString().slice(0, 10),
      day,
      closures,
    };
  });

export const closeDay = createServerFn({ method: "POST" })
  .middleware([writableAdminMiddleware])
  .validator((input: unknown) => input)
  .handler(({ context: { command }, data }) => closeStoreDayCommand(command, data));
