export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-heading-xs text-center font-bold tracking-tight uppercase">
      {children}
    </h2>
  );
}
