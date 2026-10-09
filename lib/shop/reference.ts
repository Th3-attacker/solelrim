import { format } from "date-fns";

// An order reference is half of the customer's credentials (with the phone
// number) for tracking and push, so it must not be guessable: 8 characters
// drawn by crypto from 32 symbols (~10^12 per boutique), none of them easy
// to misread or mistype — no 0/O, no 1/I. Older references
// (CMD-yyyyMMdd-NNNN) stay valid: lookups never parse the format.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 8;

export function buildOrderReference(): string {
  // 32 symbols divide 256 evenly, so taking each byte modulo 32 is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(REFERENCE_LENGTH));
  const randomPart = Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % 32]).join("");
  return `CMD-${randomPart}`;
}

export function buildSaleReference(): string {
  const datePart = format(new Date(), "yyyyMMdd");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `INV-${datePart}-${randomPart}`;
}
