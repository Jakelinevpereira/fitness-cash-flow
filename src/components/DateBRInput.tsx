import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDate, toISODate } from "@/lib/format";

/** Input dd/mm/aaaa que armazena/devolve ISO yyyy-mm-dd */
export function DateBRInput({
  value,
  onChange,
  className = "w-40",
  placeholder = "dd/mm/aaaa",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(formatDate(value));

  useEffect(() => {
    setText(formatDate(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let masked = digits;
    if (digits.length > 4) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(masked);
    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      onChange(toISODate(`${d}/${m}/${y}`));
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  return (
    <Input
      placeholder={placeholder}
      className={className}
      inputMode="numeric"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
