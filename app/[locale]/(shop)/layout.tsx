import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartTrigger } from "@/components/cart/cart-trigger";
import { Link } from "@/i18n/navigation";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="text-sm font-semibold">
              Solelrim
            </Link>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ModeToggle />
              <CartTrigger />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
          {children}
        </main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Solelrim
        </footer>
      </div>
    </CartProvider>
  );
}
