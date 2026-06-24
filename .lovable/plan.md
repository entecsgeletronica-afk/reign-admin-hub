## Diagnóstico

A tela de usuários **está carregando os 3 perfis corretamente** (confirmado via rede e SQL — `Ailton`, `Cliente Teste`, `Suporte InfoApp` todos com `display_name` preenchido). Os KPIs mostram "3 cadastrados" e "2 assinaturas ativas" justamente porque os dados chegam.

O problema é **CSS na lista virtualizada** em `src/routes/admin/_shell/usuarios.tsx` (componente `VirtualUserList`, ~linha 457):

```tsx
<div
  ref={parentRef}
  className="max-h-[560px] overflow-auto"
  style={{ contain: "strict" }}
>
```

`contain: strict` inclui *size containment*, que faz o navegador ignorar o tamanho dos filhos ao calcular a altura do container. Combinado com apenas `max-h` (sem `height` ou `min-height`), o container colapsa para **altura 0** e nada é renderizado — daí o espaço vazio entre os filtros e o final do card.

Não há erro nem estado de "vazio" porque `users.length > 0`, então o branch `<VirtualUserList />` é renderizado normalmente — só que invisível.

## Correção

Trocar `max-h-[560px]` por `h-[560px]` no container do `parentRef` (linha 459) para dar altura explícita ao scroll container, mantendo `contain: strict` (que é recomendado pelo TanStack Virtual para performance).

Arquivo afetado: `src/routes/admin/_shell/usuarios.tsx` — apenas 1 linha alterada.

## Sobre os nomes

Os nomes **já estão salvos e chegam à UI**. Após o fix do CSS, a lista exibirá os 3 usuários com seus nomes normalmente. Nenhuma mudança no fluxo de cadastro, trigger `handle_new_user` ou serviço `users.ts` é necessária.
