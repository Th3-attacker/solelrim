// Every action string the audit log records, mapped to its translation key
// under the "auditLog" namespace — writers are typed against this map, so a
// new action can't be logged without a label, and a typo is a type error
// rather than a silently blank row.
export const AUDIT_ACTION_LABEL_KEY = {
  "order.confirm": "actionOrderConfirm",
  "order.reject": "actionOrderReject",
  "order.ship": "actionOrderShip",
  "order.deliver": "actionOrderDeliver",
  "order.cancel": "actionOrderCancel",
  "product.update": "actionProductUpdate",
  "product.delete": "actionProductDelete",
  "sale.create": "actionSaleCreate",
  "sale.cancel": "actionSaleCancel",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABEL_KEY;

export function isAuditAction(value: string): value is AuditAction {
  return Object.hasOwn(AUDIT_ACTION_LABEL_KEY, value);
}
