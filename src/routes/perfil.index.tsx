import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  User as UserIcon,
  Languages,
  CreditCard,
  Heart,
  Lock,
  Trophy,
  Sprout,
  Palette,
  Star,
  Award,
  Camera,
  Mail,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCatalogProducts,
  useMostRecentProductId,
  useUserFavoriteIds,
} from "@/hooks/use-catalog-db";
import { useAuth } from "@/integrations/supabase/auth-context";
import { type CatalogProductRow } from "@/services/catalog-db";
import { ProductCard } from "@/components/app/ProductCard";
import { useUserEntitlements, useUserOrders } from "@/services/purchases";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveProductCover } from "@/lib/catalog-covers";
import { useI18n } from "@/integrations/i18n/i18n-context";
import { LOCALE_LABELS, type Locale } from "@/integrations/i18n/dictionary";
import { useActiveSubscription } from "@/services/billing";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const Route = createFileRoute("/perfil/")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Reino das Cores" },
      {
        name: "description",
        content: "Configure seu perfil, idioma, criança e acompanhe sua jornada.",
      },
    ],
  }),
  component: PerfilPage,
});

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  child_name: string | null;
  avatar_url: string | null;
  purchase_email: string | null;
}

function PerfilPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const { t, locale, enabledLocales, setLocale, isOverridden } = useI18n();

  // Active subscription (real billing data)
  const { data: billing, isLoading: billingLoading } = useActiveSubscription(
    userId,
    session?.user?.email ?? null,
  );

  React.useEffect(() => {
    if (!session) navigate({ to: "/login" });
  }, [session, navigate]);

  const { data: products = [] } = useCatalogProducts();
  const { data: favIds } = useUserFavoriteIds(userId);
  const { data: recentProductId } = useMostRecentProductId(userId);
  const { data: entitlements = [] } = useUserEntitlements(userId);
  const { data: orders = [] } = useUserOrders(userId);

  const purchaseStats = React.useMemo(() => {
    const activeCount = entitlements.filter((e) => e.status === "active").length;
    const last = entitlements[0]?.granted_at ?? orders[0]?.purchased_at ?? null;
    return { activeCount, total: entitlements.length, lastPurchase: last };
  }, [entitlements, orders]);

  const continueProduct = React.useMemo(() => {
    if (!recentProductId) return undefined;
    return products.find((p) => p.id === recentProductId);
  }, [products, recentProductId]);

  // ---- profile ----
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [childName, setChildName] = React.useState("");
  const [callMode, setCallMode] = React.useState<"name" | "you">("name");
  const [notifyOnLangChange, setNotifyOnLangChange] = React.useState(true);

  async function handleLanguageChange(next: Locale) {
    if (next === locale) return;
    await setLocale(next);
    if (notifyOnLangChange) {
      toast.success(t("toast.languageChanged"), {
        description: t("toast.languageChanged.description", {
          label: LOCALE_LABELS[next],
        }),
      });
    }
  }

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseAny
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled && data) {
        setProfile(data as ProfileRow);
        setChildName((data as ProfileRow).child_name ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const qcChild = useQueryClient();
  const childMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!userId) return;
      // Upsert profile row
      await supabaseAny
        .from("profiles")
        .upsert(
          { user_id: userId, child_name: name || null },
          { onConflict: "user_id" },
        );
    },
    onSuccess: () => {
      toast.success("Perfil da criança salvo");
      qcChild.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: () => toast.error("Não foi possível salvar"),
  });

  // ---- password ----
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const pwMutation = useMutation({
    mutationFn: async () => {
      if (pw.length < 6) throw new Error("Senha precisa ter ao menos 6 caracteres");
      if (pw !== pw2) throw new Error("As senhas não conferem");
      if (!supabase) throw new Error("Supabase não configurado");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha atualizada");
      setPw("");
      setPw2("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- avatar upload ----
  const fileRef = React.useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!userId || !supabase) return;
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("catalog-covers")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("catalog-covers").getPublicUrl(path);
      await supabaseAny
        .from("profiles")
        .upsert(
          { user_id: userId, avatar_url: data.publicUrl },
          { onConflict: "user_id" },
        );
      return data.publicUrl;
    },
    onSuccess: (url) => {
      if (url && profile) setProfile({ ...profile, avatar_url: url });
      toast.success("Foto atualizada");
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: () => toast.error("Falha no upload"),
  });

  function open(p: CatalogProductRow) {
    if (p.external_url) {
      window.open(p.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate({ to: "/produto/$slug", params: { slug: p.slug } });
  }

  // ---- progress (placeholder calculation) ----
  const totalAvailable = products.length;
  const startedCount = recentProductId ? 1 : 0;
  const favCount = favIds?.size ?? 0;
  const totalPages = totalAvailable * 30; // estimated 30 pages per story
  const completedPages = 0; // wire to user_page_progress later
  const overallPercent =
    totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

  const userInitial = (
    session?.user?.email?.[0] ?? "U"
  ).toUpperCase();

  if (!session) return null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      {/* Header / greeting */}
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-16 w-16 shrink-0"
            aria-label="Trocar foto"
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gold text-2xl font-bold text-gold-foreground">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-gold-foreground ring-2 ring-background">
              <Camera className="h-3.5 w-3.5" />
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) avatarMutation.mutate(f);
              }}
            />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("home.greeting")}
              {childName.trim() ? ` ${childName.trim()}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("home.subtitle")}
            </p>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard value={startedCount} label={t("stats.started")} />
          <StatCard value={favCount} label={t("stats.favorites")} />
          <StatCard value={totalAvailable} label={t("stats.available")} />
        </div>

        {/* Conta + Financeiro */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <SectionLabel icon={<Languages className="h-4 w-4" />}>
              {t("profile.account")}
            </SectionLabel>

            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("profile.currentLanguage")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                ✓ {locale.toUpperCase()}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              {isOverridden
                ? t("profile.languageOverride.note")
                : t("profile.languageHistory.empty")}
            </p>

            <label className="mb-2 block text-xs font-semibold text-foreground">
              {t("profile.appLanguage")}
            </label>
            <Select
              value={locale}
              onValueChange={(v) => handleLanguageChange(v as Locale)}
            >
              <SelectTrigger className="mb-4 h-12 w-full rounded-2xl border-2 border-gold/30 bg-surface-elevated text-base font-semibold text-foreground shadow-sm hover:border-gold/50 focus:ring-2 focus:ring-gold focus:border-gold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-popover shadow-xl">
                {enabledLocales.map((l) => (
                  <SelectItem
                    key={l}
                    value={l}
                    className="rounded-xl text-base font-medium focus:bg-gold/10 focus:text-foreground"
                  >
                    {LOCALE_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-elevated px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {t("profile.notifyToggle.title")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("profile.notifyToggle.description")}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyOnLangChange}
                onClick={() => setNotifyOnLangChange((v) => !v)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition",
                  notifyOnLangChange ? "bg-gold" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
                    notifyOnLangChange ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>

            <label className="mb-2 block text-xs font-semibold text-foreground">
              {t("profile.emailLabel")}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={session.user?.email ?? ""}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-border bg-surface-elevated/60 py-2.5 pl-9 pr-3 text-sm text-muted-foreground"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("profile.emailNote")}
            </p>
          </Card>

          <Card>
            <SectionLabel icon={<CreditCard className="h-4 w-4" />}>
              {t("profile.financial")}
            </SectionLabel>
            <FinancialBlock
              loading={billingLoading}
              subscription={billing?.subscription ?? null}
              plan={billing?.plan ?? null}
              t={t}
              locale={locale}
              purchaseStats={purchaseStats}
            />
          </Card>
        </div>

        {/* Perfil da criança */}
        <Card>
          <SectionLabel icon={<Heart className="h-4 w-4" />}>
            {t("profile.child")}
          </SectionLabel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder={t("profile.child.placeholder")}
              className="flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="button"
              onClick={() => {
                setChildName("");
                childMutation.mutate("");
              }}
              className="rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              {t("common.clear")}
            </button>
            <button
              type="button"
              onClick={() => childMutation.mutate(childName)}
              disabled={childMutation.isPending}
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {t("common.save")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("profile.child.note")}
          </p>

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("profile.child.callMode")}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ModeOption
                checked={callMode === "name"}
                onClick={() => setCallMode("name")}
                title={t("profile.child.byName")}
                example={`${childName || "Davi"} ✨`}
              />
              <ModeOption
                checked={callMode === "you"}
                onClick={() => setCallMode("you")}
                title={t("profile.child.byYou")}
                example="✨"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("profile.child.changeNote")}
            </p>
          </div>
        </Card>

        {/* Trocar senha */}
        <Card>
          <SectionLabel icon={<Lock className="h-4 w-4" />}>
            {t("profile.password")}
          </SectionLabel>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("profile.password.note")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("profile.password.new")}
              className="flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder={t("profile.password.confirm")}
              className="flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="button"
              onClick={() => pwMutation.mutate()}
              disabled={pwMutation.isPending}
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {t("profile.password.save")}
            </button>
          </div>
        </Card>

        {/* Progresso geral */}
        <Card>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <SectionLabel icon={<Trophy className="h-4 w-4" />}>
                {t("profile.progress")}
              </SectionLabel>
              <h3 className="text-xl font-bold text-foreground">
                {t("profile.progress.coloured", { done: completedPages, total: totalPages })}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("profile.progress.toUnlock", { percent: Math.max(0, 25 - overallPercent) })}{" "}
                <span className="inline-flex items-center gap-1 text-gold">
                  <Sprout className="h-3.5 w-3.5" /> {t("profile.progress.semente")}
                </span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gold">{overallPercent}%</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("profile.progress.complete")}
              </div>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Milestone icon={<Sprout className="h-5 w-5" />} label={t("profile.progress.semente")} pct={25} active={overallPercent >= 25} />
            <Milestone icon={<Palette className="h-5 w-5" />} label={t("profile.progress.artista")} pct={50} active={overallPercent >= 50} />
            <Milestone icon={<Star className="h-5 w-5" />} label={t("profile.progress.estrela")} pct={75} active={overallPercent >= 75} />
            <Milestone icon={<Award className="h-5 w-5" />} label={t("profile.progress.mestre")} pct={100} active={overallPercent >= 100} />
          </div>
        </Card>

        {/* Continue colorindo */}
        {continueProduct && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-foreground">
                Continue colorindo
              </h2>
              <p className="text-xs text-muted-foreground">
                Retome de onde você parou
              </p>
            </div>
            <div className="grid max-w-xs grid-cols-1">
              <ProductCard
                product={continueProduct}
                isFavorite={favIds?.has(continueProduct.id) ?? false}
                userId={userId}
                onClick={() => open(continueProduct)}
              />
            </div>
          </section>
        )}

        {/* Footer actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/favoritos"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10">
              <Heart className="h-4 w-4 text-rose-400" />
            </span>
            Ver favoritos
          </Link>
          <Link
            to="/buscar"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15">
              <UserIcon className="h-4 w-4 text-gold" />
            </span>
            Explorar todas as histórias
          </Link>
        </div>

        {/* Continue button (sticky-ish at bottom for context) */}
        {continueProduct && (
          <div className="sticky bottom-4 z-10 flex justify-end">
            <button
              type="button"
              onClick={() => open(continueProduct)}
              className="inline-flex items-center gap-3 rounded-2xl bg-gold px-4 py-2.5 text-left text-sm font-semibold text-gold-foreground shadow-xl transition-transform hover:-translate-y-0.5"
            >
              <div className="h-8 w-8 overflow-hidden rounded-md">
                {(() => {
                  const c = resolveProductCover(continueProduct);
                  return c ? (
                    <img src={c} alt="" className="h-full w-full object-cover" />
                  ) : null;
                })()}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase opacity-70">
                  ▶ Continuar
                </div>
                <div className="text-sm font-bold">{continueProduct.title}</div>
              </div>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Sair da conta
        </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      {children}
    </div>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
      {icon}
      {children}
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ModeOption({
  checked,
  onClick,
  title,
  example,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  example: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition",
        checked
          ? "border-gold bg-gold/10"
          : "border-border bg-surface-elevated hover:border-border/80",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full border",
            checked ? "border-gold" : "border-muted-foreground/40",
          )}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-gold" />}
        </span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-1 ml-6 text-xs italic text-muted-foreground">
        {example}
      </p>
    </button>
  );
}

function Milestone({
  icon,
  label,
  pct,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition",
        active
          ? "border-gold bg-gold/10 text-gold"
          : "border-border bg-surface-elevated text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          active ? "bg-gold/20" : "bg-background/40",
        )}
      >
        {icon}
      </span>
      <div className="text-xs font-bold">{label}</div>
      <div className="text-[10px] opacity-80">{pct}%</div>
    </div>
  );
}

function FinancialBlock({
  loading,
  subscription,
  plan,
  t,
  locale,
  purchaseStats,
}: {
  loading: boolean;
  subscription: import("@/services/billing").SubscriptionRow | null;
  plan: import("@/services/billing").PlanRow | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  purchaseStats: { activeCount: number; total: number; lastPurchase: string | null };
}) {
  const fmtDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso))
      : "—";

  // Compact summary block — replaces the previous heavy financial block.
  // The full purchase history now lives at /perfil/compras.
  const summaryRow = (
    <div className="grid grid-cols-3 gap-3">
      <FinField
        label="Plano atual"
        value={plan?.name ?? (subscription ? "—" : "Sem assinatura")}
      />
      <FinField label="Compras" value={purchaseStats.total} />
      <FinField label="Última compra" value={fmtDate(purchaseStats.lastPurchase)} />
    </div>
  );

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-sm text-muted-foreground">
          {t("profile.financial.loading")}
        </div>
      ) : (
        summaryRow
      )}

      <Link
        to="/perfil/compras"
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm font-semibold text-foreground transition hover:border-gold/40 hover:bg-accent"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-gold" />
          Ver minhas compras
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

function FinField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
