import * as React from "react";
import { z } from "zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/integrations/supabase/auth-context";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { bootstrapFirstAdmin, getAdminCount } from "@/services/admin";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres"),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Nome obrigatório"),
});

const bootstrapSchema = signupSchema;

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar no Reino das Cores" },
      {
        name: "description",
        content: "Faça login no Reino das Cores e acesse histórias bíblicas para crianças colorirem, pintarem e aprenderem brincando.",
      },
      { property: "og:title", content: "Entrar no Reino das Cores" },
      {
        property: "og:description",
        content: "Acesse sua conta no Reino das Cores e continue suas atividades de pintura.",
      },
      { property: "og:url", content: "https://reign-admin-hub.lovable.app/login" },
    ],
    links: [
      { rel: "canonical", href: "https://reign-admin-hub.lovable.app/login" },
    ],
  }),
  component: UserLoginPage,
});

function UserLoginPage() {
  const { signIn, session, adminProfile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"login" | "signup" | "bootstrap">("login");
  const [submitting, setSubmitting] = React.useState(false);
  const [adminCount, setAdminCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!session) return;
    if (adminProfile?.is_active) {
      navigate({ to: "/admin/dashboard" });
    } else {
      navigate({ to: "/" });
    }
  }, [session, adminProfile, navigate]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    getAdminCount().then((c) => setAdminCount(c));
  }, []);

  const noAdmins = adminCount === 0;

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
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
    if (error) return toast.error(error);
    toast.success("Bem-vindo!");
    // Redirect handled by effect once adminProfile resolves
  };

  const onSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (!supabase) {
      toast.error("Supabase não conectado.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { name: parsed.data.name },
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail.");
    setMode("login");
  };

  const onBootstrap = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = bootstrapSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSubmitting(true);
    const { error } = await bootstrapFirstAdmin(parsed.data);
    setSubmitting(false);
    if (error) return toast.error(error);
    toast.success("Administrador criado! Você já está logado.");
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
              <Sparkles className="h-3 w-3" /> Reino das Cores
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground">
              {mode === "login"
                ? "Entrar na sua conta"
                : mode === "signup"
                  ? "Criar conta"
                  : "Criar primeiro administrador"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Acesse seus desenhos, templates ou painel admin"
                : mode === "signup"
                  ? "Comece a colorir em segundos"
                  : "Defina o owner do painel administrativo"}
            </p>
          </div>

          {mode === "login" && (
            <form onSubmit={onLogin} className="mt-6 space-y-4">
              <Field label="E-mail" name="email" type="email" autoComplete="email" />
              <Field
                label="Senha"
                name="password"
                type="password"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Entrando..." : "Entrar"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={onSignup} className="mt-6 space-y-4">
              <Field label="Nome" name="name" type="text" autoComplete="name" />
              <Field label="E-mail" name="email" type="email" autoComplete="email" />
              <Field
                label="Senha"
                name="password"
                type="password"
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
              >
                {submitting ? "Criando..." : "Criar conta"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Já tem conta? Entrar
              </button>
            </form>
          )}

          {mode === "bootstrap" && (
            <form onSubmit={onBootstrap} className="mt-6 space-y-4">
              <Field label="Nome" name="name" type="text" autoComplete="name" />
              <Field label="E-mail" name="email" type="email" autoComplete="email" />
              <Field
                label="Senha"
                name="password"
                type="password"
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
              >
                {submitting ? "Criando..." : "Criar administrador"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar para o login
              </button>
            </form>
          )}
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
