# Checklist de Regressão — Fluxo de Pintura

Este checklist cobre os pontos críticos do editor de pintura
(`src/routes/pintar.$slug.$page.tsx`) para evitar que bugs já corrigidos
voltem. Execute o checklist completo após qualquer alteração em:

- `src/routes/pintar.$slug.$page.tsx`
- `src/services/catalog-progress.ts`
- `src/services/story-pages.ts`
- Tabelas `user_artworks` ou `user_page_progress`

---

## 1. Miniaturas da Sidebar

Para cada item, abra uma história com pelo menos 3 páginas e confirme:

- [ ] **M1.** Páginas nunca pintadas exibem **apenas o lineart** (sem
  preenchimento amarelo da sugestão pré-colorida).
- [ ] **M2.** Página **ativa** sem nenhuma pincelada também aparece em branco
  (sem overlay residual de outra página).
- [ ] **M3.** Após **uma pincelada**, a miniatura da página ativa atualiza
  imediatamente (sem aguardar 20s do autosave).
- [ ] **M4.** Após **um clique no balde** (fill), a miniatura reflete a área
  preenchida em tempo real.
- [ ] **M5.** Após executar a **Mágica**, a miniatura reflete o resultado
  imediatamente ao final da animação.
- [ ] **M6.** Pintar a página 1 NÃO altera as miniaturas das páginas 2 e 3 —
  cada miniatura reflete somente sua própria pintura.
- [ ] **M7.** Após pintar 1 ou 2 páginas e deixar a 3ª intocada, a 3ª
  miniatura permanece em branco mesmo após autosave.

---

## 2. Persistência (Sair / Voltar)

- [ ] **P1.** Pintar parcialmente uma página, sair da história (botão voltar
  ou navegar para outra rota) e retornar — a pintura aparece na imagem central
  e na miniatura.
- [ ] **P2.** Pintar parcialmente, **fechar a aba** do navegador e reabrir —
  a pintura persiste (autosave de unmount funcionou).
- [ ] **P3.** Pintar página 1, navegar para página 2 dentro da mesma história
  pelas miniaturas — página 1 salva antes de navegar e aparece pintada ao
  voltar para ela.
- [ ] **P4.** Confirmar no banco com:
  ```sql
  SELECT page_index, is_finished, length(canvas_data_json::text) AS size, updated_at
  FROM user_artworks
  WHERE user_id = '<uid>' AND story_slug = '<slug>'
  ORDER BY page_index;
  ```
  Cada página com pintura tem uma linha; `is_finished = false` é OK para
  pinturas parciais.

---

## 3. Autosave

- [ ] **A1.** Pintar e aguardar 20s sem interação — `user_artworks.updated_at`
  avança no banco (autosave por intervalo).
- [ ] **A2.** Pintar e navegar para outra página dentro da história — save
  síncrono dispara antes da navegação.
- [ ] **A3.** Pintar e desmontar o componente (sair da história) — `useEffect`
  de cleanup chama `saveMutation.mutate()`.

---

## 4. Ferramentas (Tinta / Balde / Mágica)

- [ ] **T1.** Pincel: traços contínuos pintam corretamente; SFX dispara.
- [ ] **T2.** Balde: respeita as bordas do lineart (máscara fechada); não
  vaza para regiões adjacentes.
- [ ] **T3.** Borracha: remove apenas a pintura, não o lineart.
- [ ] **T4.** Mágica: cobre ≥ 92% da página em uma execução típica; toast
  reporta cobertura final.
- [ ] **T5.** Após qualquer ferramenta, `progressPercent` na barra superior
  atualiza.
- [ ] **T6.** Ao atingir ≥ 92% de cobertura, modal de celebração abre
  **uma única vez** (guard `completionShownRef`).

---

## 5. Botão "Sugestão" (REMOVIDO)

- [ ] **S1.** Não existe nenhum botão visível "Sugestão" / "Lightbulb" na
  toolbar.
- [ ] **S2.** Build sem warnings de variáveis não usadas relacionadas a
  `showSuggestion`, `suggestionGenerating` ou `Lightbulb`.
- [ ] **S3.** A lógica de extração de paleta (`generateSuggestionFromLineart`,
  `effectiveSuggestionUrl`, `suggestionPalette`) **continua existindo** porque
  é consumida pela Mágica.

---

## 6. Acesso e Permissões

- [ ] **AC1.** Usuário sem entitlement não consegue abrir uma página de
  produto bloqueado (RLS em `user_artworks`).
- [ ] **AC2.** Admin consegue ver todas as artworks (policy
  `Admins view all artworks`).

---

## 7. Verificação Automatizada

```bash
# Typecheck — deve passar sem erros
bunx tsc --noEmit

# Lint — sem warnings de imports/vars não utilizados
bun run lint

# Smoke test do schema (artworks parciais existem no banco?)
psql -c "SELECT count(*) FROM user_artworks WHERE is_finished = false;"
```

---

## Histórico de Bugs Corrigidos (Não Reintroduzir)

1. **Miniaturas amareladas em todas as páginas** — causado por usar
   `image_preview_url` (sample colorido) como base do thumb. Correção: usar
   `image_lineart_url`.
2. **Miniaturas refletindo a pintura da página errada** — causado por
   reutilizar o snapshot da página ativa em todas as miniaturas. Correção:
   `livePaintSnapshot` só vale para `active`; demais usam `paintByPage.get()`
   por `page_number`.
3. **Demora de 20s para a miniatura atualizar** — corrigido com
   `setLivePaintSnapshot` em `maybeCelebrateCompletion`.
4. **Botão Sugestão dependia de estados órfãos** — removido painel + estados
   `showSuggestion` / `suggestionGenerating`, mantida lógica de paleta para
   a Mágica.
