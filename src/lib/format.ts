export const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export const formatDate = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const formatMonth = (ym: string) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};
