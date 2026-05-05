import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingCart, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transacoes", label: "Transações", icon: Receipt },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-2 px-6 py-6 border-b">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Fitness Cash</h1>
            <p className="text-xs text-muted-foreground">Fluxo de caixa</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 border-b bg-card px-4 py-3 sticky top-0 z-10">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-semibold">Fitness Cash</span>
        </header>

        <nav className="md:hidden flex overflow-x-auto border-b bg-card">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={cn("flex-1 text-center px-3 py-3 text-xs font-medium whitespace-nowrap", active ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
