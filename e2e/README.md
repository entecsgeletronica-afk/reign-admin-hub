# E2E — Proteção de rotas /admin/*

Valida que:

1. Qualquer rota `/admin/*` acessada sem login redireciona para `/admin/login`.
2. Um usuário com role `admin` consegue logar e acessar `/admin/dashboard`.

## Como rodar

```bash
# 1. dev server precisa estar rodando em http://localhost:8080
bun run dev

# 2. credenciais admin (obrigatório para o teste de login)
export E2E_ADMIN_EMAIL="entecsgeletronica@gmail.com"
export E2E_ADMIN_PASSWORD="sua-senha"

# 3. rodar
bunx playwright test
```

Se `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` não estiverem definidos, o teste
de login é pulado automaticamente — os redirects sem sessão continuam rodando.

Variáveis opcionais:
- `E2E_BASE_URL` — usa uma URL externa (preview/published) em vez de iniciar o dev local.