import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, PiggyBank, Package } from "lucide-react";
import { formatBRL, formatMonth } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Fitness Cash" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: tx = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("transaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").order("sale_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sum = (arr: { total: number | string }[]) => arr.reduce((s, t) => s + Number(t.total), 0);
  const isPendingSale = (s: { payment_method?: string | null }) => s.payment_method === "A receber" || s.payment_method === "A pagar";
  const vendasPagas = sales.filter((s) => !isPendingSale(s));
  const vendasPendentes = sales.filter(isPendingSale);
  const saldoInicial = sum(tx.filter((t) => t.type === "saldo_inicial"));
  const vendasTotais = sum(sales);
  const recebido = sum(vendasPagas);
  const aReceber = sum(vendasPendentes);
  const receitasExtras = sum(tx.filter((t) => t.type === "receita"));
  const despesas = sum(tx.filter((t) => t.type === "despesa"));
  const compras = sum(tx.filter((t) => t.type === "compra"));
  const saldo = saldoInicial + recebido + receitasExtras - despesas - compras;
  const totalVendas = sales.length;

  // Group by category — apenas despesas operacionais + compras
  const byCategory: Record<string, number> = {};
  tx.filter((t) => t.type === "despesa" || t.type === "compra").forEach((t) => {
    const key = t.type === "compra" ? `Compras: ${t.category}` : t.category;
    byCategory[key] = (byCategory[key] || 0) + Number(t.total);
  });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  // Monthly chart
  const monthly: Record<string, { mes: string; receitas: number; despesas: number; compras: number }> = {};
  const addMonth = (date: string, key: "receitas" | "despesas" | "compras", val: number) => {
    const m = date.slice(0, 7);
    if (!monthly[m]) monthly[m] = { mes: m, receitas: 0, despesas: 0, compras: 0 };
    monthly[m][key] += val;
  };
  tx.forEach((t) => {
    if (t.type === "receita") addMonth(t.transaction_date, "receitas", Number(t.total));
    else if (t.type === "despesa") addMonth(t.transaction_date, "despesas", Number(t.total));
    else if (t.type === "compra") addMonth(t.transaction_date, "compras", Number(t.total));
  });
  sales.forEach((s) => addMonth(s.sale_date, "receitas", Number(s.total)));
  const barData = Object.values(monthly).sort((a, b) => a.mes.localeCompare(b.mes));

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da sua loja fitness</p>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatCard title="Saldo Inicial" value={formatBRL(saldoInicial)} icon={PiggyBank} accent="accent" />
          <StatCard title="Vendas Totais (Faturamento)" value={formatBRL(vendasTotais)} icon={ShoppingCart} accent="primary" />
          <StatCard title="Recebido" value={formatBRL(recebido)} icon={TrendingUp} accent="success" />
          <StatCard title="A Receber" value={formatBRL(aReceber)} icon={TrendingUp} accent="accent" />
          <StatCard title="Despesas Operacionais" value={formatBRL(despesas)} icon={TrendingDown} accent="destructive" />
          <StatCard title="Compras de Estoque" value={formatBRL(compras)} icon={Package} accent="accent" />
          <StatCard title="Saldo em Caixa" value={formatBRL(saldo)} icon={Wallet} accent="primary" />
          <StatCard title="Total de Vendas" value={String(totalVendas)} icon={ShoppingCart} accent="success" />
        </div>

        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            <strong className="text-foreground">Cálculo do saldo (apenas recebido):</strong> {formatBRL(saldoInicial)} (inicial) + {formatBRL(recebido)} (recebido){receitasExtras > 0 ? ` + ${formatBRL(receitasExtras)} (outras receitas)` : ""} − {formatBRL(despesas)} (despesas) − {formatBRL(compras)} (estoque) = <strong className="text-foreground">{formatBRL(saldo)}</strong>. <span className="font-medium">A receber: {formatBRL(aReceber)}</span> não entra no caixa até ser pago.
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Receitas vs Saídas (mensal)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {barData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={formatMonth} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="compras" name="Compras" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
            <CardContent className="h-72">
              {pieData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(e: { name: string }) => e.name}>
                      {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, accent }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: "success" | "destructive" | "primary" | "accent" }) {
  const bg = accent === "success" ? "var(--gradient-success)" : accent === "destructive" ? "var(--gradient-danger)" : "var(--gradient-primary)";
  return (
    <Card className="overflow-hidden relative">
      <div className="absolute top-0 right-0 h-24 w-24 rounded-full opacity-10 -mr-8 -mt-8" style={{ background: bg }} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}
