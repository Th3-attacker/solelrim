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
      <div className="shop-theme flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Sol<span className="text-primary">elrim</span>
            </Link>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ModeToggle />
              <CartTrigger />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 md:py-10">
          {children}
        </main>
        <footer className="border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            © {new Date().getFullYear()} Solelrim
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
