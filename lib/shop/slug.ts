const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(DIACRITICS_RE, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "produit"
  );
}
