# QA — Toggle "Ver como admin" vs "Ver como usuário"

Roteiro manual para validar que os cadeados e o acesso a produtos mudam
corretamente conforme o modo de visualização escolhido pelo admin, em
todas as áreas de membros.

> **Objetivo**: garantir que produtos marcados como `is_locked = true` (sem
> entitlement do usuário) **mostrem o cadeado** quando o admin está em modo
> "aluno" e **não mostrem o cadeado** quando está em modo "admin", em todas
> as variações/áreas existentes — sem regressão no fluxo do cliente real.

---

## Pré-requisitos

1. Estar logado como **admin** (papel `admin` em `user_roles`).
2. Ter pelo menos **2 áreas de membros** publicadas (ex.: "Reino das Cores
   Kids" e "teste 2").
3. Em cada área, ter:
   - Pelo menos **1 produto público** (`is_locked = false`).
   - Pelo menos **1 produto bloqueado** (`is_locked = true`) ao qual o admin
     **não tem entitlement explícito**. Sugestão: "Arca de Noé".
4. Limpar o `localStorage` do navegador antes de começar (chave
   `admin:view-as-mode`) para começar do estado padrão.

---

## Mapa dos pontos de entrada

A escolha de modo aparece em **3 lugares** que devem ser testados:

| Local | Como chegar | Comportamento esperado |
|---|---|---|
| **Card da área** em `/admin/areas` | Botões "Ver como admin" / "Ver como aluno" no card | Abre **nova aba** com `?variation=<id>` (admin) ou `?variation=<id>&preview=user` (aluno) |
| **Editor da área** em `/admin/areas/<id>` | Botões no header do editor | Abre **nova aba**, mesmo padrão acima |
| **Shell "Ver como"** em `/admin/ver-como-usuario` | Toggle segmentado no topo (UserRound / ShieldCheck) | Atualiza o **iframe inline** sem abrir nova aba; persiste em `localStorage` (`admin:view-as-mode`) |

---

## Roteiro de testes

### T1 — Card da área (`/admin/areas`)

1. Acesse `/admin/areas`.
2. No card de uma área que tenha produto bloqueado (ex.: "Reino das Cores Kids"):
   1. Clique em **"Ver como admin"**.
      - **Esperado**: nova aba abre com URL `…/?variation=<id>` (sem
        `preview=user`). Catálogo carrega e o produto bloqueado **NÃO**
        exibe o ícone de cadeado.
   2. Volte ao admin e clique em **"Ver como aluno"** no mesmo card.
      - **Esperado**: nova aba abre com `…/?variation=<id>&preview=user`.
        O mesmo produto bloqueado agora **exibe o cadeado** (badge no canto
        superior direito do card).

### T2 — Header do editor da área (`/admin/areas/<id>`)

1. Em `/admin/areas`, clique em "Personalizar área" de uma das áreas.
2. No header do editor, repita os dois cliques de T1 (admin e aluno).
   - **Esperado**: mesmo comportamento de T1. As duas abas abertas devem
     diferir apenas pela presença do cadeado nos produtos bloqueados.

### T3 — Shell "Ver como" (`/admin/ver-como-usuario`)

1. Acesse `/admin/ver-como-usuario` (ou clique em "Ver como aluno" e troque
   manualmente para essa rota).
2. Confira o toggle no topo: deve iniciar com a opção persistida em
   `localStorage` (default: **"Ver como usuário"**).
3. Com o toggle em **"Ver como usuário"**:
   - **Esperado**: iframe carrega `…?variation=<id>&as=user&preview=user`.
     Produtos bloqueados mostram cadeado.
4. Clique em **"Ver como admin"**:
   - **Esperado**: iframe **recarrega imediatamente** (a URL muda de
     `as=user` para `as=admin`, o que dispara o remount via `key`).
     Cadeados desaparecem.
5. Recarregue a página inteira do admin (`F5`).
   - **Esperado**: o toggle volta com o último modo escolhido (persistência
     via `localStorage`).
6. Mude a área via menu de variações (canto superior direito do shell).
   - **Esperado**: iframe recarrega com a nova `variation`, mantendo o modo
     escolhido.
7. Clique no botão "Recarregar" (ícone refresh):
   - **Esperado**: iframe recarrega mesmo sem trocar URL (via `reloadNonce`).

### T4 — Atalhos de rota dentro do shell

Com o shell aberto e o modo em **"Ver como usuário"**:

1. Clique nos atalhos do toolbar: `Home`, `Buscar`, `Favoritos`, `Perfil`,
   `Compras`, `Explorar`.
2. Em cada um:
   - **Esperado**: iframe atualiza para o novo path mantendo `as=user` e
     `preview=user` na query. Cadeados continuam visíveis em qualquer tela
     que liste produtos.
3. Alterne para **"Ver como admin"** e percorra os mesmos atalhos.
   - **Esperado**: cadeados não aparecem em nenhuma das telas.

### T5 — Validação cruzada com a regra de negócio

1. Conceda um entitlement explícito ao admin para o produto bloqueado
   (`user_product_entitlements` com `status='active'`).
2. Recarregue o iframe em **"Ver como usuário"**.
   - **Esperado**: o produto deixa de exibir cadeado mesmo no modo aluno,
     porque o admin agora **possui o produto** (não é mais o override de
     admin que está liberando).
3. Remova o entitlement.
   - **Esperado**: cadeado volta a aparecer no modo aluno.

### T6 — Múltiplas áreas

Repita T1–T4 para **cada área publicada** no projeto. O comportamento deve
ser idêntico independentemente da variação ativa — confirma que o ajuste
foi aplicado de forma global e não específico a uma área.

---

## Critérios de aceite

- ✅ Em **modo admin** (sem `preview=user`): nenhum produto exibe cadeado,
  independentemente de `is_locked`.
- ✅ Em **modo aluno** (`preview=user` na URL ou toggle no shell):
  - Produtos com `is_locked=false` → sem cadeado.
  - Produtos com `is_locked=true` e **sem entitlement** → **com cadeado**.
  - Produtos com `is_locked=true` e **com entitlement ativo** → sem cadeado.
- ✅ Toggle no shell persiste após reload (`localStorage`
  `admin:view-as-mode`).
- ✅ Iframe recarrega automaticamente ao alternar modo, trocar área ou
  trocar atalho de rota — sem precisar clicar em "Recarregar".
- ✅ Botão "Recarregar" força refresh mesmo sem mudança de URL.
- ✅ Comportamento é o **mesmo em todas as áreas/variações**.

---

## Sinais de regressão a observar

| Sintoma | Provável causa |
|---|---|
| Cadeado nunca aparece, mesmo em modo aluno | `forceUserView` não está chegando em `getAccessibleProductIds` — checar `useEntitlements` e a query `?preview=user` |
| Cadeado sempre aparece, mesmo em modo admin | Override de admin removido por engano em `entitlements.ts` |
| Iframe não recarrega ao trocar modo | `iframeKey` deixou de ser derivado de `previewUrl` no shell |
| Toggle volta ao default após reload | `safeStorage` falhou — checar `VIEW_MODE_KEY` |
| Funciona em uma área mas não em outra | `variation` não está sendo propagada na URL — checar `setActive` e `variationForPreview` |

---

## Arquivos relacionados

- `src/services/entitlements.ts` — fonte de verdade das regras de acesso
  (`getAccessibleProductIds` aceita `forceUserView`).
- `src/hooks/use-entitlements.ts` — detecta `?preview=user` e ativa
  `forceUserView`.
- `src/routes/admin/_shell/ver-como-usuario.tsx` — shell com toggle e
  iframe; `previewUrl` agora carrega `as=<mode>` como fonte única.
- `src/routes/admin/_shell/areas.tsx` — botões "Ver como admin/aluno" no
  card da área.
- `src/routes/admin/_shell/areas.$areaId.tsx` — botões equivalentes no
  header do editor.
