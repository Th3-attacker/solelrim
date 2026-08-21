export type ShareResult = "shared" | "copied";

// navigator.share and navigator.clipboard both require a secure context
// (HTTPS, or localhost) — over plain HTTP (a LAN IP during testing, or a
// misconfigured deploy) both are simply undefined, and a caller that only
// checks `navigator.share` before falling through to
// `navigator.clipboard.writeText` throws on that second call too, with
// nothing catching it. This always either opens the native share sheet,
// copies to the clipboard, or throws — so the caller can show real
// feedback in every case instead of the click silently doing nothing.
export async function shareContent(data: ShareData): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && navigator.share) {
    if (!navigator.canShare || navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return "shared";
      } catch (error) {
        // A user-initiated cancel must stay a cancel, not silently become a
        // clipboard copy the user never asked for. Anything else — e.g. some
        // Huawei/HMS browsers expose navigator.share but it throws instead
        // of opening a working share sheet — falls through to the clipboard
        // fallback below instead of surfacing a dead end.
        if (isShareCancelled(error)) throw error;
      }
    }
  }
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("share-unavailable");
  }
  const text = [data.title, data.text, data.url].filter(Boolean).join("\n");
  await navigator.clipboard.writeText(text);
  return "copied";
}

export function isShareCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
