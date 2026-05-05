import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart } from "lucide-react";
import { formatBRL } from "@/lib/format";
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

  const receitas = tx.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.total), 0)
    + sales.reduce((s, t) => s + Number(t.total), 0);
  const despesas = tx.filter((t) => t.type === "despesa" || t.type === "compra").reduce((s, t) => s + Number(t.total), 0);
  const saldo = receitas - despesas;
  const totalVendas = sales.length;

  // Group by category for despesas
  const byCategory: Record<string, number> = {};
  tx.filter((t) => t.type !== "receita").forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.total);
  });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  // Monthly chart
  const monthly: Record<string, { mes: string; receitas: number; despesas: number }> = {};
  const addMonth = (date: string, key: "receitas" | "despesas", val: number) => {
    const m = date.slice(0, 7);
    if (!monthly[m]) monthly[m] = { mes: m, receitas: 0, despesas: 0 };
    monthly[m][key] += val;
  };
  tx.forEach((t) => {
    if (t.type === "receita") addMonth(t.transaction_date, "receitas", Number(t.total));
    else addMonth(t.transaction_date, "despesas", Number(t.total));
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

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Receitas" value={formatBRL(receitas)} icon={TrendingUp} accent="success" />
          <StatCard title="Despesas" value={formatBRL(despesas)} icon={TrendingDown} accent="destructive" />
          <StatCard title="Saldo em caixa" value={formatBRL(saldo)} icon={Wallet} accent="primary" />
          <StatCard title="Total de vendas" value={String(totalVendas)} icon={ShoppingCart} accent="accent" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Receitas vs Despesas (mensal)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {barData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receitas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="despesas" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
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
