import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { useActiveVariation } from "./variation-context";

/**
 * Mantém <title> e o favicon do documento sincronizados com a variação
 * (área de membros) ativa.
 *
 * IMPORTANTE: o branding da variação (nome do app + favicon) só deve aparecer
 * nas áreas de membros (rotas do usuário) e nos modos de preview ("Ver como
 * aluno"/"Ver como admin"). No painel admin (/admin/*) e na tela de login do
 * admin mantemos o branding institucional padrão definido no root route
 * ("APP COLORIR"), conforme decisão do produto.
 *
 * - Roda só no client (usa document).
 * - Restaura os valores originais ao desmontar para evitar "vazar" o branding
 *   de uma área para outra durante navegação.
 */
export function DocumentBrandingSync() {
  const variation = useActiveVariation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search =
    typeof window !== "undefined" ? window.location.search : "";

  const isPreview =
    /[?&](as|preview|variation)=/.test(search) || search.includes("variation=");
  // Admin shell e login do admin usam branding institucional, exceto em preview.
  const isAdminArea =
    pathname === "/admin" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/");

  const shouldApplyVariationBranding = !isAdminArea || isPreview;

  const appName = shouldApplyVariationBranding
    ? variation.app_name ?? variation.title ?? null
    : null;
  const faviconUrl = shouldApplyVariationBranding
    ? variation.favicon_url ?? null
    : null;

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    // ---------- Title ----------
    const previousTitle = document.title;
    if (appName) {
      // Mantém um sufixo discreto para diferenciar do nome da área.
      document.title = appName;
    }

    // ---------- Favicon ----------
    // Localiza (ou cria) um único <link rel="icon"> gerenciado por nós.
    let link = document.querySelector<HTMLLinkElement>(
      'link[rel~="icon"][data-managed="variation"]',
    );
    let created = false;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-managed", "variation");
      document.head.appendChild(link);
      created = true;
    }
    const previousHref = link.getAttribute("href");

    if (faviconUrl) {
      // Remove ícones concorrentes (não gerenciados) para garantir que o
      // browser use o nosso. Mantemos apenas os marcados como gerenciados.
      const others = document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"]:not([data-managed="variation"])',
      );
      others.forEach((el) => el.parentElement?.removeChild(el));

      link.href = faviconUrl;
    } else if (created) {
      // Sem favicon definido e fomos nós que criamos a tag → remove.
      link.parentElement?.removeChild(link);
      link = null;
    }

    return () => {
      document.title = previousTitle;
      if (link && !created && previousHref != null) {
        link.href = previousHref;
      }
    };
  }, [appName, faviconUrl]);

  return null;
}
