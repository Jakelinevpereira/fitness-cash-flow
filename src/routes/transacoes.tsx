import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { TransactionsView } from "@/components/TransactionsView";

export const Route = createFileRoute("/transacoes")({
  head: () => ({ meta: [{ title: "Transações — Fitness Cash" }] }),
  component: () => <AppLayout><TransactionsView /></AppLayout>,
});
