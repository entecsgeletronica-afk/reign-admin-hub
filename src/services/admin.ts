import { supabase, supabaseAny } from "@/integrations/supabase/client";

export async function getAdminCount(): Promise<number | null> {
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) {
    console.warn("[admin] getAdminCount error:", error.message);
    return null;
  }
  return count ?? 0;
}

export async function bootstrapFirstAdmin(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase não conectado." };
  }
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: `${window.location.origin}/admin/dashboard`,
      data: { name: params.name },
    },
  });
  if (signUpError) return { error: signUpError.message };
  const userId = signUpData.user?.id;
  if (!userId) return { error: "Falha ao criar usuário." };

  const { error: insertError } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: "admin",
  });
  if (insertError) return { error: insertError.message };

  await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  return { error: null };
}
