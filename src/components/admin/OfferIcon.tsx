import * as React from "react";

/**
 * Ícone "Oferta" inspirado visualmente no logotipo da Perfect Pay
 * (P estilizado com cantos arredondados). Renderizado em SVG inline para
 * herdar `currentColor` e combinar com os demais ícones do menu.
 */
export function OfferIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 7.5h4.25c1.93 0 3.5 1.46 3.5 3.25 0 1.79-1.57 3.25-3.5 3.25H10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7.5v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
