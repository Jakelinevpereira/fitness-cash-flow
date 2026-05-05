import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Fitness Cash" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [fName, setFName] = useState("");
  const [fCategory, setFCategory] = useState("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: Partial<Product> & { id?: string }) => {
      if (p.id) {
        const { error } = await supabase.from("products").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(p as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setOpen(false); setEditing(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Removido"); },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground text-sm mt-1">Catálogo da loja</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo produto</Button></DialogTrigger>
            <ProductDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} loading={upsert.isPending} />
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto</TableCell></TableRow>
                ) : rows.map((p) => {
                  const margin = Number(p.sale_price) - Number(p.cost_price);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category ?? "-"}</TableCell>
                      <TableCell className="text-right">{formatBRL(Number(p.cost_price))}</TableCell>
                      <TableCell className="text-right">{formatBRL(Number(p.sale_price))}</TableCell>
                      <TableCell className="text-right text-success font-medium">{formatBRL(margin)}</TableCell>
                      <TableCell className="text-right"><Badge variant={p.stock > 0 ? "secondary" : "outline"}>{p.stock}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) remove.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function ProductDialog({ editing, onSubmit, loading }: { editing: Product | null; onSubmit: (d: Partial<Product> & { id?: string }) => void; loading: boolean }) {
  const [f, setF] = useState({
    name: editing?.name ?? "",
    category: editing?.category ?? "",
    cost_price: String(editing?.cost_price ?? 0),
    sale_price: String(editing?.sale_price ?? 0),
    stock: String(editing?.stock ?? 0),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-2">
        <Fld label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Fld>
        <Fld label="Categoria"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Ex: Roupas fitness" /></Fld>
        <div className="grid grid-cols-3 gap-3">
          <Fld label="Custo"><Input type="number" step="0.01" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} /></Fld>
          <Fld label="Venda"><Input type="number" step="0.01" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} /></Fld>
          <Fld label="Estoque"><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Fld>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={loading || !f.name} onClick={() => onSubmit({ id: editing?.id, name: f.name, category: f.category || null, cost_price: Number(f.cost_price), sale_price: Number(f.sale_price), stock: Number(f.stock) })}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
