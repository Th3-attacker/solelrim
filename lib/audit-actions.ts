// Maps each action string recorded by lib/audit.ts's logAdminAction to its
// translation key under the "auditLog" namespace — kept as a lookup so a
// typo in either place shows up as a missing key, not a silently blank row.
export const AUDIT_ACTION_LABEL_KEY: Record<string, string> = {
  "order.confirm": "actionOrderConfirm",
  "order.reject": "actionOrderReject",
  "order.ship": "actionOrderShip",
  "order.deliver": "actionOrderDeliver",
  "order.cancel": "actionOrderCancel",
  "product.update": "actionProductUpdate",
  "product.delete": "actionProductDelete",
};
