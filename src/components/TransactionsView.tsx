import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Tx = Tables<"transactions">;

const TYPES = ["receita", "despesa", "compra", "saldo_inicial"] as const;
const TYPE_LABEL: Record<string, string> = { receita: "Receita", despesa: "Despesa Operacional", compra: "Compra de Estoque", saldo_inicial: "Saldo Inicial" };
const CATEGORIES = ["Maquininha", "Embalagem", "Marketing/Outros", "Frete", "Aluguel", "Salário", "Estoque", "Caixa", "Outros"];

export function TransactionsView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [fType, setFType] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Tx> & { id?: string }) => {
      const total = Number(payload.quantity ?? 1) * Number(payload.unit_value ?? 0);
      const body = { ...payload, total };
      if (payload.id) {
        const { error } = await supabase.from("transactions").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(body as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false); setEditing(null);
      toast.success("Salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Receitas, despesas e compras</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova transação</Button>
          </DialogTrigger>
          <TxDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} loading={upsert.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma transação</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.transaction_date)}</TableCell>
                  <TableCell>
                    <Badge className={
                      r.type === "receita" ? "bg-success text-success-foreground" :
                      r.type === "saldo_inicial" ? "bg-accent text-accent-foreground" :
                      r.type === "compra" ? "bg-warning text-warning-foreground" :
                      "bg-destructive text-destructive-foreground"
                    }>
                      {TYPE_LABEL[r.type] ?? r.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(r.unit_value))}</TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(Number(r.total))}</TableCell>
                  <TableCell>{r.paid ? <Badge className="bg-success text-success-foreground">ok</Badge> : <Badge variant="outline">pendente</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TxDialog({ editing, onSubmit, loading }: { editing: Tx | null; onSubmit: (d: Partial<Tx> & { id?: string }) => void; loading: boolean }) {
  const [form, setForm] = useState({
    type: editing?.type ?? "despesa",
    category: editing?.category ?? "Compras",
    description: editing?.description ?? "",
    quantity: String(editing?.quantity ?? 1),
    unit_value: String(editing?.unit_value ?? 0),
    paid: editing?.paid ?? true,
    transaction_date: editing?.transaction_date ?? new Date().toISOString().slice(0, 10),
  });
  const total = (Number(form.quantity) || 0) * (Number(form.unit_value) || 0);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} transação</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Descrição"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantidade"><Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Valor unitário"><Input type="number" step="0.01" value={form.unit_value} onChange={(e) => setForm({ ...form, unit_value: e.target.value })} /></Field>
          <Field label="Total"><Input value={formatBRL(total)} disabled /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} /></Field>
          <Field label="Pago?">
            <Select value={form.paid ? "sim" : "nao"} onValueChange={(v) => setForm({ ...form, paid: v === "sim" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={loading || !form.description} onClick={() => onSubmit({
          id: editing?.id,
          type: form.type,
          category: form.category,
          description: form.description,
          quantity: Number(form.quantity),
          unit_value: Number(form.unit_value),
          paid: form.paid,
          transaction_date: form.transaction_date,
        })}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
