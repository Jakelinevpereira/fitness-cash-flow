import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, TrendingUp, PiggyBank, Boxes, Clock3, Receipt, ShoppingCart, Tag } from "lucide-react";
import { formatBRL, formatMonth } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard financeiro — Fitness Cash" },
      { name: "description", content: "Saldo, faturamento, lucro e estoque da sua loja fitness em uma visão só." },
      { property: "og:title", content: "Dashboard financeiro — Fitness Cash" },
      { property: "og:description", content: "Saldo, faturamento, lucro e estoque da sua loja fitness em uma visão só." },
    ],
  }),
  component: Dashboard,
});

const RECEIVED_PENDING = ["A receber", "A pagar"];

function Dashboard() {
  const [period, setPeriod] = useState<"mes" | "3m" | "12m" | "tudo">("tudo");

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
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const startISO = useMemo(() => {
    if (period === "tudo") return "";
    const now = new Date();
    const months = period === "mes" ? 0 : period === "3m" ? 2 : 11;
    const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, [period]);

  const inPeriod = (date: string) => !startISO || (date ?? "") >= startISO;

  const sum = (arr: { total: number | string }[]) => arr.reduce((s, t) => s + Number(t.total), 0);
  const isPending = (s: { payment_method?: string | null }) => RECEIVED_PENDING.includes(s.payment_method ?? "");

  // Saldo em caixa: sempre acumulado (não depende do filtro de período)
  const saldoInicial = sum(tx.filter((t) => t.type === "saldo_inicial"));
  const recebidoTotal = sum(sales.filter((s) => !isPending(s)));
  const receitasExtrasTotal = sum(tx.filter((t) => t.type === "receita"));
  const despesasTotal = sum(tx.filter((t) => t.type === "despesa"));
  const comprasTotal = sum(tx.filter((t) => t.type === "compra"));
  const saldo = saldoInicial + recebidoTotal + receitasExtrasTotal - despesasTotal - comprasTotal;

  // Indicadores do período
  const salesP = sales.filter((s) => inPeriod(s.sale_date));
  const txP = tx.filter((t) => inPeriod(t.transaction_date));
  const faturamento = sum(salesP);
  const aReceber = sum(salesP.filter(isPending));
  const despesasOp = sum(txP.filter((t) => t.type === "despesa"));

  const costById = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.id, Number(p.cost_price ?? 0)));
    return m;
  }, [products]);
  const costByName = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.name.trim().toLowerCase(), Number(p.cost_price ?? 0)));
    return m;
  }, [products]);
  const unitCost = (s: { product_id?: string | null; product_name: string }) =>
    (s.product_id ? costById.get(s.product_id) : undefined) ?? costByName.get(s.product_name?.trim().toLowerCase() ?? "") ?? 0;

  const cmv = salesP.reduce((acc, s) => acc + unitCost(s) * Number(s.quantity ?? 0), 0);
  const lucro = faturamento - cmv - despesasOp;
  const valorEstoque = products.reduce((acc, p) => acc + Number(p.stock ?? 0) * Number(p.cost_price ?? 0), 0);
  const totalVendas = salesP.length;
  const ticketMedio = totalVendas ? faturamento / totalVendas : 0;

  // Séries mensais
  const monthly = useMemo(() => {
    const map: Record<string, { mes: string; receitas: number; despesas: number; vendas: number; pecas: number }> = {};
    const touch = (m: string) => (map[m] ??= { mes: m, receitas: 0, despesas: 0, vendas: 0, pecas: 0 });
    salesP.forEach((s) => {
      const m = touch((s.sale_date ?? "").slice(0, 7));
      m.receitas += Number(s.total);
      m.vendas += 1;
      m.pecas += Number(s.quantity ?? 0);
    });
    txP.forEach((t) => {
      const m = touch((t.transaction_date ?? "").slice(0, 7));
      if (t.type === "receita") m.receitas += Number(t.total);
      else if (t.type === "despesa" || t.type === "compra") m.despesas += Number(t.total);
    });
    return Object.values(map)
      .filter((m) => m.mes)
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [salesP, txP]);

  const spark = (key: "receitas" | "despesas" | "vendas") => monthly.map((m) => ({ v: m[key] }));
  const sparkLucro = monthly.map((m) => ({ v: m.receitas - m.despesas }));

  // Produtos mais vendidos
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    salesP.forEach((s) => {
      const key = s.product_name?.trim() || "Sem nome";
      const cur = map.get(key) ?? { name: key, qty: 0, total: 0 };
      cur.qty += Number(s.quantity ?? 0);
      cur.total += Number(s.total);
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [salesP]);

  // Baixo giro: estoque disponível e sem venda há mais tempo
  const lowTurnover = useMemo(() => {
    const lastSale = new Map<string, string>();
    sales.forEach((s) => {
      const key = s.product_name?.trim().toLowerCase() ?? "";
      const prev = lastSale.get(key);
      if (!prev || (s.sale_date ?? "") > prev) lastSale.set(key, s.sale_date ?? "");
    });
    const today = new Date();
    return products
      .filter((p) => Number(p.stock ?? 0) > 0)
      .map((p) => {
        const d = lastSale.get(p.name.trim().toLowerCase());
        const days = d ? Math.max(0, Math.round((today.getTime() - new Date(`${d}T00:00:00`).getTime()) / 86400000)) : null;
        return { name: p.name, stock: Number(p.stock ?? 0), days };
      })
      .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 6);
  }, [products, sales]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Saúde do negócio em poucos segundos</p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[150px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="tudo">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </header>

        {/* KPIs principais */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Saldo em Caixa" value={formatBRL(saldo)} hint="Somente valores já recebidos" icon={Wallet} tone="primary" data={sparkLucro} />
          <KpiCard title="Faturamento do período" value={formatBRL(faturamento)} hint={`${totalVendas} vendas`} icon={TrendingUp} tone="accent" data={spark("receitas")} />
          <KpiCard title="Lucro Líquido" value={formatBRL(lucro)} hint="Faturamento − custo dos produtos − despesas" icon={PiggyBank} tone={lucro >= 0 ? "success" : "destructive"} data={sparkLucro} />
          <KpiCard title="Valor do Estoque (custo)" value={formatBRL(valorEstoque)} hint={`${products.filter((p) => Number(p.stock ?? 0) > 0).length} produtos disponíveis`} icon={Boxes} tone="accent" />
        </section>

        {/* Indicadores complementares */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniCard title="A Receber" value={formatBRL(aReceber)} icon={Clock3} highlight={aReceber > 0} />
          <MiniCard title="Despesas Operacionais" value={formatBRL(despesasOp)} icon={Receipt} />
          <MiniCard title="Total de Vendas" value={String(totalVendas)} icon={ShoppingCart} />
          <MiniCard title="Ticket Médio" value={formatBRL(ticketMedio)} icon={Tag} />
        </section>

        {/* Gráficos */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Receita x Despesas (mensal)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {monthly.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={(l: string) => formatMonth(l)} contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                    <Legend iconType="circle" />
                    <Bar dataKey="receitas" name="Receitas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Evolução das vendas (mensal)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {monthly.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={(l: string) => formatMonth(l)} contentStyle={tooltipStyle} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="vendas" name="Vendas" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="pecas" name="Peças" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Tabelas */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Produtos mais vendidos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {topProducts.length === 0 ? <div className="p-6"><Empty /></div> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 text-left font-medium">Produto</th>
                      <th className="px-5 py-2.5 text-right font-medium">Qtd</th>
                      <th className="px-5 py-2.5 text-right font-medium">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="max-w-[220px] truncate px-5 py-3">{p.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{p.qty}</td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">{formatBRL(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Produtos com baixo giro</CardTitle></CardHeader>
            <CardContent className="p-0">
              {lowTurnover.length === 0 ? <div className="p-6"><Empty /></div> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 text-left font-medium">Produto</th>
                      <th className="px-5 py-2.5 text-right font-medium">Estoque</th>
                      <th className="px-5 py-2.5 text-right font-medium">Dias sem venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowTurnover.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="max-w-[220px] truncate px-5 py-3">{p.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{p.stock}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{p.days === null ? "Nunca vendido" : `${p.days} dias`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 } as const;

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  data,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "destructive" | "accent";
  data?: { v: number }[];
}) {
  const bg =
    tone === "success" ? "var(--gradient-success)" : tone === "destructive" ? "var(--gradient-danger)" : "var(--gradient-primary)";
  const stroke = tone === "success" ? "var(--chart-2)" : tone === "destructive" ? "var(--chart-5)" : tone === "accent" ? "var(--chart-3)" : "var(--chart-1)";
  const id = `spark-${title.replace(/\W/g, "")}`;
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: bg }}>
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums md:text-3xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {data && data.length > 1 && (
          <div className="mt-3 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={`url(#${id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniCard({
  title,
  value,
  icon: Icon,
  highlight,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className={`text-lg font-semibold tabular-nums ${highlight ? "text-warning" : ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}
