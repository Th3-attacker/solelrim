import { prisma } from "@/lib/prisma";
import { computeRefund } from "@/lib/shop/refund";
import { toPageNumber } from "@/lib/shop/pagination";

// productType and the viewer always come from the caller's own session.

export type RefundViewer = {
  id: string;
  role: "SUPERADMIN" | "BOUTIQUE_ADMIN" | "SELLER";
};

const REQUEST_INCLUDE = {
  items: {
    select: {
      quantity: true,
      saleItem: {
        select: {
          id: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} as const;

type RequestRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedByEmail: string;
  createdAt: Date;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  rejectionReason: string | null;
  amount: { toNumber(): number } | null;
  paymentMethod: string | null;
  walletProvider: string | null;
  items: {
    quantity: number;
    saleItem: {
      id: string;
      variant: { size: string; color: string; product: { name: string } };
    };
  }[];
};

function toRequestView(request: RequestRow, estimatedAmount: number | null) {
  return {
    id: request.id,
    status: request.status,
    reason: request.reason,
    requestedByEmail: request.requestedByEmail,
    createdAt: request.createdAt,
    decidedByEmail: request.decidedByEmail,
    decidedAt: request.decidedAt,
    rejectionReason: request.rejectionReason,
    // Final once approved; an estimate while pending.
    amount: request.amount?.toNumber() ?? estimatedAmount,
    paymentMethod: request.paymentMethod,
    walletProvider: request.walletProvider,
    items: request.items.map((item) => ({
      name: item.saleItem.variant.product.name,
      size: item.saleItem.variant.size,
      color: item.saleItem.variant.color,
      quantity: item.quantity,
    })),
  };
}

type SaleForEstimate = {
  subtotal: { toNumber(): number };
  total: { toNumber(): number };
  refundedAmount: { toNumber(): number };
  items: {
    id: string;
    unitPrice: { toNumber(): number };
    quantity: number;
    refundedQuantity: number;
  }[];
};

function estimate(
  sale: SaleForEstimate,
  request: { items: { quantity: number; saleItem: { id: string } }[] },
) {
  const requested = new Map(
    request.items.map((item) => [item.saleItem.id, item.quantity]),
  );
  return (
    computeRefund({
      subtotal: sale.subtotal.toNumber(),
      total: sale.total.toNumber(),
      refundedAmount: sale.refundedAmount.toNumber(),
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: 0,
      previousPointsTakenBack: 0,
      previousPointsReturned: 0,
      lines: sale.items.map((line) => ({
        saleItemId: line.id,
        unitPrice: line.unitPrice.toNumber(),
        quantity: line.quantity,
        refundedQuantity: line.refundedQuantity,
        refundQuantity: requested.get(line.id) ?? 0,
      })),
    })?.amount ?? null
  );
}

// Everything a sale page needs to offer and follow refunds: each line with
// what's still refundable, and the sale's requests.
export async function getSaleRefunds(saleId: string, productType: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, productType },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      walletProvider: true,
      subtotal: true,
      total: true,
      refundedAmount: true,
      items: {
        select: {
          id: true,
          quantity: true,
          refundedQuantity: true,
          unitPrice: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      refundRequests: {
        orderBy: { createdAt: "desc" },
        include: REQUEST_INCLUDE,
      },
    },
  });
  if (!sale) return null;

  return {
    saleId: sale.id,
    refundable:
      sale.status === "COMPLETED" || sale.status === "PARTIALLY_REFUNDED",
    hasPending: sale.refundRequests.some(
      (request) => request.status === "PENDING",
    ),
    paymentMethod: sale.paymentMethod,
    subtotal: sale.subtotal.toNumber(),
    total: sale.total.toNumber(),
    refundedAmount: sale.refundedAmount.toNumber(),
    lines: sale.items.map((line) => ({
      saleItemId: line.id,
      name: line.variant.product.name,
      size: line.variant.size,
      color: line.variant.color,
      unitPrice: line.unitPrice.toNumber(),
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
    })),
    requests: sale.refundRequests.map((request) => ({
      ...toRequestView(
        request,
        request.status === "PENDING" ? estimate(sale, request) : null,
      ),
      salePaymentMethod: sale.paymentMethod,
      saleWalletProvider: sale.walletProvider,
    })),
  };
}

export const REFUNDS_PAGE_SIZE = 25;

// A seller follows their own requests; an admin sees every request of the
// boutique, pending ones first.
export async function listRefundRequests(
  productType: string,
  viewer: RefundViewer,
  status: "PENDING" | "APPROVED" | "REJECTED" | null,
  page = 1,
) {
  const currentPage = toPageNumber(page);
  const where = {
    productType,
    ...(viewer.role === "SELLER" && { requestedById: viewer.id }),
    ...(status && { status }),
  };
  const [requests, total] = await Promise.all([
    prisma.refundRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * REFUNDS_PAGE_SIZE,
      take: REFUNDS_PAGE_SIZE,
      include: {
        ...REQUEST_INCLUDE,
        sale: {
          select: {
            id: true,
            reference: true,
            paymentMethod: true,
            walletProvider: true,
            subtotal: true,
            total: true,
            refundedAmount: true,
            items: {
              select: {
                id: true,
                unitPrice: true,
                quantity: true,
                refundedQuantity: true,
              },
            },
          },
        },
      },
    }),
    prisma.refundRequest.count({ where }),
  ]);

  return {
    requests: requests.map((request) => ({
      ...toRequestView(
        request,
        request.status === "PENDING" ? estimate(request.sale, request) : null,
      ),
      saleId: request.sale.id,
      saleReference: request.sale.reference,
      salePaymentMethod: request.sale.paymentMethod,
      saleWalletProvider: request.sale.walletProvider,
    })),
    total,
    page: currentPage,
  };
}

export async function countPendingRefunds(productType: string) {
  return prisma.refundRequest.count({
    where: { productType, status: "PENDING" },
  });
}
