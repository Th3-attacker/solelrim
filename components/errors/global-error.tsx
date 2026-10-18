import type { ErrorComponentProps } from "@tanstack/react-router";
import { useReportedError } from "@/hooks/use-reported-error";

// Ex-app/global-error.tsx. Last-resort boundary for errors no closer
// boundary handles (and for those that escape the [locale] layout itself) —
// it can't rely on the translations being available. Deliberately plain and
// not translated.
export function GlobalError({ error, reset }: ErrorComponentProps) {
  const reference = useReportedError(error as Error);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
      <p style={{ color: "#666", margin: 0, maxWidth: "24rem" }}>
        Please try again, or come back a little later.
      </p>
      {reference && (
        <p style={{ color: "#666", margin: 0, fontSize: "0.75rem" }}>Reference: {reference}</p>
      )}
      <button
        onClick={() => reset()}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "#18181b",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

// Ex-page 404 par défaut de Next.js, pour une URL hors de toute langue.
export function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-heading-sm">404</h1>
      <p className="text-paragraph-md text-muted-foreground">This page could not be found.</p>
    </div>
  );
}
