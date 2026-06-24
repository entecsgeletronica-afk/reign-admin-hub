# QA Checklist — Assinatura: estampa única independente de mudanças de cor

**Rota:** `/pintar/:slug/:page` (ex.: `/pintar/arca-de-noe/3`)
**Bug original:** ao alternar cores no rodapé enquanto uma assinatura está
sendo posicionada, várias assinaturas ficavam estampadas no canvas (uma por
clique de cor / confirmação acidental).
**Comportamento esperado:** sempre exatamente **1 (uma)** assinatura
gravada por ciclo de "Assinar → posicionar → Confirmar", independente de
quantas vezes a cor for trocada antes do commit.

---

## Pré-requisitos

- Estar logado com um usuário que tenha acesso à página de pintura.
- Abrir uma página de história qualquer (ex.: `/pintar/arca-de-noe/3`).
- DevTools aberto na aba **Console** (para conferir ausência de erros
  e contar chamadas a `stampSignature` se necessário via breakpoint).
- Histórico de pintura (Undo) limpo — usar **Apagar** se necessário.

---

## Cenário 1 — Mudança de cor antes de confirmar (caso original do bug)

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Clicar no botão **Assinar** no rodapé | Cursor muda para "text". Nenhum dialog ainda. |
| 2 | Clicar em qualquer ponto do canvas | Abre o dialog "Como você quer assinar?". |
| 3 | Digitar um nome (ex.: `Maria`) e enviar (Enter ou botão) | Dialog fecha. Aparece um **draft flutuante** com borda dourada e toolbar (−, %, +, Cancelar, Confirmar). |
| 4 | Clicar na cor **vermelha** no rodapé | A cor do texto da prévia muda para vermelho **na hora**. Nenhum pixel novo no canvas. |
| 5 | Clicar na cor **azul** | Prévia fica azul. Canvas inalterado. |
| 6 | Clicar na cor **verde** | Prévia fica verde. Canvas inalterado. |
| 7 | Clicar em **Confirmar** | Exatamente **1** assinatura verde é gravada no canvas. |
| 8 | Apertar **Ctrl+Z** uma única vez | A assinatura desaparece. Não restam fragmentos de outras cores. |

✅ **Aprovado se:** após o passo 7 só existe uma assinatura visível, na cor
selecionada por último (verde), e o Undo a remove em uma única operação.

❌ **Reprovado se:** aparecem várias assinaturas sobrepostas em cores
diferentes, ou o Undo precisa ser apertado mais de uma vez para limpar
o resultado de um único ciclo.

---

## Cenário 2 — Double-click no Confirmar

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Repetir passos 1-3 do cenário 1 | Draft flutuante visível. |
| 2 | Dar um **double-click rápido** no botão Confirmar | Apenas **1** assinatura gravada. O botão fica `disabled` após o primeiro clique (opacidade reduzida + cursor not-allowed). |
| 3 | Apertar **Ctrl+Z** uma vez | Assinatura removida em uma única operação. |

✅ **Aprovado se:** o segundo clique do double-click é absorvido sem
efeito (lock atômico em `signatureCommitLockRef`).

---

## Cenário 3 — Enter segurado

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Repetir passos 1-3 do cenário 1 | Draft flutuante visível. |
| 2 | Segurar a tecla **Enter** por ~2 segundos | Apenas **1** assinatura gravada. Repetições do SO são ignoradas (`ev.repeat === true` curto-circuita antes do lock). |
| 3 | Soltar Enter, apertar Ctrl+Z uma vez | Assinatura removida em uma única operação. |

✅ **Aprovado se:** mesmo com dezenas de eventos `keydown` repetidos,
apenas o primeiro disparou o stamp.

---

## Cenário 4 — Click em Confirmar + Enter no mesmo frame

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Repetir passos 1-3 do cenário 1 | Draft flutuante visível. |
| 2 | Mover o mouse sobre **Confirmar**, clicar **e** apertar Enter quase simultaneamente | Apenas **1** assinatura gravada. |

✅ **Aprovado se:** o segundo evento (qualquer que seja) vê o lock
levantado e sai imediatamente.

---

## Cenário 5 — Cancelar não deve gravar nada

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Repetir passos 1-3 do cenário 1 | Draft flutuante visível. |
| 2 | Trocar a cor 3 vezes no rodapé | Prévia muda a cada clique. Canvas inalterado. |
| 3 | Apertar **Esc** ou clicar **Cancelar** | Draft desaparece. Canvas continua exatamente como estava antes do passo 1. |
| 4 | Apertar Ctrl+Z | Não acontece nada (não há entrada de assinatura no histórico). |

✅ **Aprovado se:** nenhum pixel da assinatura aparece no canvas e o
histórico do Undo continua intacto.

---

## Cenário 6 — Múltiplas assinaturas legítimas em sequência

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Completar um ciclo Assinar → Confirmar com cor vermelha | 1 assinatura vermelha gravada. |
| 2 | Repetir o ciclo em outro local com cor azul | 2 assinaturas no canvas (1 vermelha + 1 azul). |
| 3 | Repetir com cor verde | 3 assinaturas no canvas. |

✅ **Aprovado se:** o lock é liberado corretamente entre ciclos e o
usuário pode assinar quantas vezes quiser, **uma por confirmação**.

---

## Cenário 7 — Defesa contra propagação ao canvas

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 1 | Estar em modo Assinar com um draft flutuante visível | OK |
| 2 | Clicar várias vezes nas cores do rodapé | Nenhum dialog adicional é aberto. Nenhum pixel novo no canvas. Nenhuma entrada nova no Undo. |

✅ **Aprovado se:** `e.stopPropagation()` no swatch impede o evento de
borbulhar até o handler do canvas, e o `pushHistory()` foi movido para
depois do early-return de signature mode.

---

## Critérios técnicos de aceitação

A implementação deve garantir os 3 níveis de proteção documentados
em código:

1. **Lock no pai** — `signatureCommitLockRef` (boolean ref) levantado
   no primeiro `onCommit` do ciclo, liberado em `setTimeout(0)` após
   o stamp ou imediatamente em cancel.
2. **Lock local no overlay** — `committedRef` envolvendo `safeCommit`
   / `safeCancel` para que teclado e botão nunca chamem `onCommit`
   mais de uma vez no ciclo de vida do draft.
3. **Setter funcional atômico** — `setDraftSignature((current) => { ...
   stampSignature(...); return null; })` garante leitura fresca do
   estado mesmo sob batched updates do React.

Defesas adicionais:

- `ev.repeat` ignorado em keydown do Enter.
- Botão Confirmar fica `disabled` após o primeiro clique (feedback visual).
- `pushHistory()` no `onPointerDown` do canvas só roda para ações
  que mutam pixels — signature mode nunca polui o stack.
- Swatches usam `e.stopPropagation()` defensivamente.
