import * as React from "react";
import { z } from "zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/integrations/supabase/auth-context";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres"),
});

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { signIn, session, adminProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const [waitingProfile, setWaitingProfile] = React.useState(false);

  // Redirect once we have a session AND admin role resolved.
  React.useEffect(() => {
    if (!session) return;
    if (adminProfile?.is_active) {
      navigate({ to: "/admin/dashboard" });
    } else if (waitingProfile && !loading) {
      // Logado mas sem role admin
      toast.error("Esta conta não tem acesso administrativo.");
      setWaitingProfile(false);
    }
  }, [session, adminProfile, loading, navigate, waitingProfile]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Bem-vindo!");
    setWaitingProfile(true);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--gold) 25%, transparent), transparent)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl">
          <div className="text-center">
            <img
              src={logo}
              alt="Reino das Cores"
              className="mx-auto h-20 w-20 object-contain drop-shadow-lg"
            />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
              <ShieldCheck className="h-3 w-3" /> Painel Administrativo
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground">
              Entrar como administrador
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse o painel de gestão do Reino das Cores
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="E-mail" name="email" type="email" autoComplete="email" />
            <Field
              label="Senha"
              name="password"
              type="password"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={submitting || waitingProfile || !isSupabaseConfigured}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting || waitingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {submitting ? "Entrando..." : "Verificando acesso..."}
                </>
              ) : (
                <>
                  Entrar no painel
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            {!isSupabaseConfigured && (
              <p className="text-center text-xs text-destructive">
                Supabase não está configurado.
              </p>
            )}
          </form>

          <div className="mt-6 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-gold" />
            Acesso restrito a contas com permissão de administrador
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar para o site
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="block w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
