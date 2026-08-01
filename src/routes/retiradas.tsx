import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, PiggyBank, Wallet, HandCoins, Landmark } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate, toISODate } from "@/lib/format";
import { DateBRInput } from "@/components/DateBRInput";

export const Route = createFileRoute("/retiradas")({
  head: () => ({
    meta: [
      { title: "Retiradas de lucro — Fitness Cash" },
      { name: "description", content: "Controle quanto do lucro já foi retirado, preservando o capital inicial investido na loja." },
      { property: "og:title", content: "Retiradas de lucro — Fitness Cash" },
      { property: "og:description", content: "Controle quanto do lucro já foi retirado, preservando o capital inicial investido na loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Retiradas,
});

const PENDING = ["A receber", "A pagar"];

function Retiradas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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

  const create = useMutation({
    mutationFn: async (d: { description: string; value: number; transaction_date: string }) => {
      const { error } = await supabase.from("transactions").insert({
        type: "retirada",
        category: "Retirada de lucro",
        description: d.description,
        quantity: 1,
        unit_value: d.value,
        total: d.value,
        paid: true,
        transaction_date: d.transaction_date,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); setOpen(false); toast.success("Retirada registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Retirada removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sum = (arr: { total: number | string }[]) => arr.reduce((s, t) => s + Number(t.total), 0);
  const isPending = (s: { payment_method?: string | null }) => PENDING.includes(s.payment_method ?? "");

  const retiradas = useMemo(() => tx.filter((t) => t.type === "retirada"), [tx]);
  const capitalInicial = sum(tx.filter((t) => t.type === "saldo_inicial"));
  const recebido = sum(sales.filter((s) => !isPending(s)));
  const receitasExtras = sum(tx.filter((t) => t.type === "receita"));
  const despesas = sum(tx.filter((t) => t.type === "despesa"));
  const compras = sum(tx.filter((t) => t.type === "compra"));
  const totalRetirado = sum(retiradas);
  const saldoCaixa = capitalInicial + recebido + receitasExtras - despesas - compras - totalRetirado;

  const costOf = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, Number(p.cost_price ?? 0)]));
    const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), Number(p.cost_price ?? 0)]));
    return (s: { product_id?: string | null; product_name: string }) =>
      (s.product_id ? byId.get(s.product_id) : undefined) ?? byName.get(s.product_name?.trim().toLowerCase() ?? "") ?? 0;
  }, [products]);

  const cmv = sales.filter((s) => !isPending(s)).reduce((acc, s) => acc + costOf(s) * Number(s.quantity ?? 0), 0);
  const lucroAcumulado = recebido + receitasExtras - cmv - despesas;
  const lucroDisponivel = Math.max(0, lucroAcumulado - totalRetirado);
  const disponivelRetirar = Math.max(0, Math.min(saldoCaixa, lucroDisponivel));
  const capitalPreservado = Math.min(capitalInicial, Math.max(0, saldoCaixa + (products.reduce((a, p) => a + Number(p.stock ?? 0) * Number(p.cost_price ?? 0), 0))));
  const pct = capitalInicial > 0 ? Math.min(100, (capitalPreservado / capitalInicial) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Retiradas de lucro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Retire aos poucos, preservando o capital inicial de {formatBRL(capitalInicial)}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova retirada</Button>
            </DialogTrigger>
            <RetiradaDialog max={disponivelRetirar} loading={create.isPending} onSubmit={(d) => create.mutate(d)} />
          </Dialog>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi title="Capital inicial" value={formatBRL(capitalInicial)} hint="Valor que você investiu para começar" icon={Landmark} />
          <Kpi title="Lucro acumulado" value={formatBRL(lucroAcumulado)} hint="Recebido − custo dos produtos − despesas" icon={PiggyBank} tone={lucroAcumulado >= 0 ? "success" : "destructive"} />
          <Kpi title="Já retirado" value={formatBRL(totalRetirado)} hint={`${retiradas.length} retirada(s)`} icon={HandCoins} />
          <Kpi title="Disponível para retirar" value={formatBRL(disponivelRetirar)} hint="Limitado pelo lucro e pelo caixa atual" icon={Wallet} tone={disponivelRetirar > 0 ? "success" : "muted"} />
        </section>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Saúde do capital</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p className="text-muted-foreground">Caixa hoje: <span className="font-semibold text-foreground tabular-nums">{formatBRL(saldoCaixa)}</span></p>
              <p className="text-muted-foreground">Capital + estoque: <span className="font-semibold text-foreground tabular-nums">{formatBRL(capitalPreservado)}</span></p>
              <p className="text-muted-foreground">Lucro ainda não retirado: <span className="font-semibold text-foreground tabular-nums">{formatBRL(lucroDisponivel)}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">
              Retire apenas o lucro: o valor disponível já desconta o capital preso em estoque e as contas a receber ainda não recebidas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Histórico de retiradas</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retiradas.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma retirada registrada</TableCell></TableRow>
                ) : retiradas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.transaction_date)}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatBRL(Number(r.total))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover retirada?")) remove.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {retiradas.length > 0 && (
                <tfoot className="border-t bg-muted/50">
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-semibold">Total retirado</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatBRL(totalRetirado)}</TableCell>
                    <TableCell />
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function RetiradaDialog({ max, loading, onSubmit }: { max: number; loading: boolean; onSubmit: (d: { description: string; value: number; transaction_date: string }) => void }) {
  const [description, setDescription] = useState("Retirada de lucro");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const v = Number(value) || 0;

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Nova retirada</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <DateBRInput className="w-full" value={date} onChange={setDate} />
          </div>
        </div>
        <p className={`text-xs ${v > max ? "text-destructive" : "text-muted-foreground"}`}>
          Disponível para retirar: {formatBRL(max)}{v > max ? " — você está retirando parte do capital." : ""}
        </p>
      </div>
      <DialogFooter>
        <Button disabled={loading || v <= 0 || !description} onClick={() => onSubmit({ description, value: v, transaction_date: toISODate(date) })}>
          Registrar retirada
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Kpi({ title, value, hint, icon: Icon, tone = "primary" }: {
  title: string; value: string; hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "destructive" | "muted";
}) {
  const bg = tone === "success" ? "var(--gradient-success)" : tone === "destructive" ? "var(--gradient-danger)" : tone === "muted" ? "var(--secondary)" : "var(--gradient-primary)";
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: bg }}>
            <Icon className={`h-5 w-5 ${tone === "muted" ? "text-secondary-foreground" : "text-primary-foreground"}`} />
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
