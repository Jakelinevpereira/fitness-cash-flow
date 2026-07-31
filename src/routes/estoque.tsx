import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Fitness Cash" },
      { name: "description", content: "Quantidades e valores em estoque da loja fitness." },
      { property: "og:title", content: "Estoque — Fitness Cash" },
      { property: "og:description", content: "Quantidades e valores em estoque da loja fitness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const [fName, setFName] = useState("");
  const [fCategory, setFCategory] = useState("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
  });

  const categories = Array.from(new Set(rows.map((p) => p.category).filter(Boolean))) as string[];
  const inStock = rows
    .filter((p) => Number(p.stock) > 0)
    .filter((p) => (!fName || p.name.toLowerCase().includes(fName.toLowerCase())) && (fCategory === "all" || (p.category ?? "") === fCategory));

  const totalQty = inStock.reduce((s, p) => s + Number(p.stock), 0);
  const totalCost = inStock.reduce((s, p) => s + Number(p.cost_price) * Number(p.stock), 0);
  const totalSale = inStock.reduce((s, p) => s + Number(p.sale_price) * Number(p.stock), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-1">Somente itens disponíveis, com quantidades e valores</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Itens diferentes" value={String(inStock.length)} />
          <Stat label="Peças em estoque" value={String(totalQty)} />
          <Stat label="Valor de custo" value={formatBRL(totalCost)} />
          <Stat label="Valor de venda" value={formatBRL(totalSale)} accent />
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Produto</Label>
              <Input className="w-48" placeholder="Buscar" value={fName} onChange={(e) => setFName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo un.</TableHead>
                  <TableHead className="text-right">Venda un.</TableHead>
                  <TableHead className="text-right">Total custo</TableHead>
                  <TableHead className="text-right">Total venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inStock.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum item em estoque</TableCell></TableRow>
                ) : inStock.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ?? "-"}</TableCell>
                    <TableCell>{(p as Product & { size?: string | null }).size ?? "-"}</TableCell>
                    <TableCell>{(p as Product & { color?: string | null }).color ?? "-"}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{p.stock}</Badge></TableCell>
                    <TableCell className="text-right">{formatBRL(Number(p.cost_price))}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(p.sale_price))}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(p.cost_price) * Number(p.stock))}</TableCell>
                    <TableCell className="text-right font-medium text-success">{formatBRL(Number(p.sale_price) * Number(p.stock))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {inStock.length > 0 && (
                <tfoot className="border-t bg-muted/50 font-medium">
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">Totais</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{totalQty}</Badge></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatBRL(totalCost)}</TableCell>
                    <TableCell className="text-right font-bold text-success">{formatBRL(totalSale)}</TableCell>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${accent ? "text-success" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
