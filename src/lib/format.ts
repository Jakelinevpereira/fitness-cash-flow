export const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export const formatDate = (d: string) => {
  if (!d) return "";
  const iso = toISODate(d);
  if (!iso) return d;
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
};

export const toISODate = (date: string | number | Date | null | undefined) => {
  if (!date) return "";
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const value = String(date).trim();
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const parts = iso ? { y: iso[1], m: iso[2], d: iso[3] } : br ? { y: br[3], m: br[2], d: br[1] } : null;
  if (!parts) return "";
  const y = Number(parts.y.length === 2 ? `20${parts.y}` : parts.y);
  const m = Number(parts.m);
  const d = Number(parts.d);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export const formatMonth = (ym: string) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};
