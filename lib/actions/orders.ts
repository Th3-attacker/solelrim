"use server";

import { after } from "next/server";
import { requireWritableAdminScope } from "@/lib/auth/scope";
import { logAdminAction } from "@/lib/audit";
import { sendOrderPush } from "@/lib/push/order-push";
import { notifyOrdersChanged } from "@/lib/realtime";
import { revalidateSite, revalidateAdmin } from "@/lib/revalidate";
import {
  orderInputFrom,
  placeOrder,
  trackOrder as lookUpOrder,
  type PlaceOrderResult,
  type TrackOrderResult,
} from "@/lib/services/orders";
import {
  cancelOrderTransition,
  confirmOrderTransition,
  deliverOrderTransition,
  rejectOrderTransition,
  shipOrderTransition,
} from "@/lib/services/order-transitions";

// The customer side (placing and tracking an order) lives in
// lib/services/orders.ts, shared with the app's API routes; these are the
// website's entry points to it.

export type {
  PlaceOrderResult as SubmitOrderResult,
  TrackOrderResult,
  TrackedOrderItem,
} from "@/lib/services/orders";

export async function submitOrder(
  formData: FormData,
  options?: { idempotencyKey?: string },
): Promise<PlaceOrderResult> {
  return placeOrder(orderInputFrom(formData), options);
}

export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  return lookUpOrder(input);
}

export async function confirmOrder(orderId: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const result = await confirmOrderTransition(orderId, productType);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    admin,
    productType,
    action: "order.confirm",
    targetLabel: result.reference,
    targetId: orderId,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "confirmed"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function rejectOrder(orderId: string, reason: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const result = await rejectOrderTransition(orderId, productType, reason);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    admin,
    productType,
    action: "order.reject",
    targetLabel: result.reference,
    targetId: orderId,
    reason,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "rejected"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function shipOrder(orderId: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const result = await shipOrderTransition(orderId, productType);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    admin,
    productType,
    action: "order.ship",
    targetLabel: result.reference,
    targetId: orderId,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "shipped"));
  after(() => notifyOrdersChanged(productType));
  revalidateAdmin();
  return {};
}

export async function deliverOrder(orderId: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const result = await deliverOrderTransition(orderId, productType);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    admin,
    productType,
    action: "order.deliver",
    targetLabel: result.reference,
    targetId: orderId,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "delivered"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}

export async function cancelOrder(orderId: string, reason: string): Promise<{ error?: string }> {
  const { admin, productType } = await requireWritableAdminScope();
  const result = await cancelOrderTransition(orderId, productType, reason);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    admin,
    productType,
    action: "order.cancel",
    targetLabel: result.reference,
    targetId: orderId,
    reason,
  });

  // After the response: the admin doesn't wait on Expo (up to 4 s), and a
  // push that fails never touches the action (sendOrderPush never throws).
  after(() => sendOrderPush(orderId, "cancelled"));
  after(() => notifyOrdersChanged(productType));
  revalidateSite();
  return {};
}
