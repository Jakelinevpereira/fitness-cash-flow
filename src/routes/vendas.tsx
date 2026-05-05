import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Sale = Tables<"sales">;
type Product = Tables<"products">;

const PAYMENTS = ["Dinheiro", "Pix", "Crédito", "Débito"];

export const Route = createFileRoute("/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Fitness Cash" }] }),
  component: SalesPage,
});

function SalesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*")).data ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (s: Partial<Sale> & { id?: string }) => {
      const total = Number(s.quantity ?? 1) * Number(s.unit_price ?? 0);
      const body = { ...s, total };
      if (s.id) {
        const { error } = await supabase.from("sales").update(body).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales").insert(body as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); setOpen(false); setEditing(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sales").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); toast.success("Removido"); },
  });

  const total = rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vendas</h1>
            <p className="text-muted-foreground text-sm mt-1">Total: <span className="font-semibold text-foreground">{formatBRL(total)}</span></p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova venda</Button></DialogTrigger>
            <SaleDialog editing={editing} products={products} onSubmit={(d) => upsert.mutate(d)} loading={upsert.isPending} />
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma venda</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.sale_date)}</TableCell>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(r.unit_price))}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{formatBRL(Number(r.total))}</TableCell>
                    <TableCell>{r.payment_method ?? "-"}</TableCell>
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
    </AppLayout>
  );
}

function SaleDialog({ editing, products, onSubmit, loading }: { editing: Sale | null; products: Product[]; onSubmit: (d: Partial<Sale> & { id?: string }) => void; loading: boolean }) {
  const [f, setF] = useState({
    product_id: editing?.product_id ?? "",
    product_name: editing?.product_name ?? "",
    quantity: String(editing?.quantity ?? 1),
    unit_price: String(editing?.unit_price ?? 0),
    payment_method: editing?.payment_method ?? "Pix",
    sale_date: editing?.sale_date ?? new Date().toISOString().slice(0, 10),
  });
  const total = (Number(f.quantity) || 0) * (Number(f.unit_price) || 0);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} venda</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-2">
        <Fld label="Produto">
          {products.length > 0 ? (
            <Select value={f.product_id || "manual"} onValueChange={(v) => {
              if (v === "manual") { setF({ ...f, product_id: "", product_name: "" }); return; }
              const p = products.find((x) => x.id === v);
              if (p) setF({ ...f, product_id: p.id, product_name: p.name, unit_price: String(p.sale_price) });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Digitar manualmente</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {!f.product_id && <Input className="mt-2" placeholder="Nome do produto" value={f.product_name} onChange={(e) => setF({ ...f, product_name: e.target.value })} />}
        </Fld>
        <div className="grid grid-cols-3 gap-3">
          <Fld label="Quantidade"><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Fld>
          <Fld label="Preço unit."><Input type="number" step="0.01" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Fld>
          <Fld label="Total"><Input value={formatBRL(total)} disabled /></Fld>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Data"><Input type="date" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></Fld>
          <Fld label="Pagamento">
            <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={loading || !f.product_name} onClick={() => onSubmit({
          id: editing?.id,
          product_id: f.product_id || null,
          product_name: f.product_name,
          quantity: Number(f.quantity),
          unit_price: Number(f.unit_price),
          payment_method: f.payment_method,
          sale_date: f.sale_date,
        })}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
