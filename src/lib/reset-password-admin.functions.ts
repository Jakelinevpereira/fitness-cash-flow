import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email(), password: z.string().min(6) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("Usuário não encontrado");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: data.password });
    if (error) throw error;
    return { ok: true };
  });
