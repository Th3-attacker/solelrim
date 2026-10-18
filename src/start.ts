import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { decimalSerializationAdapter } from "@/lib/serialization";
import { localeFunctionMiddleware } from "@/src/middleware/locale-function";
import { proxyMiddleware, requestContextMiddleware } from "@/src/middleware/request";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    // Les server functions (dont les server actions) ne répondent qu'aux
    // requêtes venues de ce site.
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
    requestContextMiddleware,
    proxyMiddleware,
  ],
  functionMiddleware: [localeFunctionMiddleware],
  serializationAdapters: [decimalSerializationAdapter],
}));
