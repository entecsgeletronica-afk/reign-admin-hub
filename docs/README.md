# Documentação — Reino das Cores Admin (SaaS Blueprint)

Esta pasta contém **toda a documentação técnica** do sistema, com foco no
que precisa ser replicado quando alguém faz **remix** do projeto e conecta
um novo Supabase.

## Estrutura

```
docs/
├── README.md                       ← este arquivo
├── database/
│   ├── README.md                   ← guia de setup do Supabase
│   ├── backup-sql.sql             ← backup SQL completo (todas migrations consolidadas)
│   ├── migrations/                 ← cópia de todas as migrations versionadas
│   ├── storage_buckets.md          ← buckets de Storage e políticas
│   ├── secrets.md                  ← secrets/env vars necessários
│   ├── functions.md                ← funções SQL (security definer, triggers, etc.)
│   └── tables.md                   ← lista de tabelas + propósito
├── qa/                             ← cenários de QA já validados
├── remix-guide.md                  ← passo a passo para fazer remix
└── deploy-vercel.md                ← 🚀 deploy próprio na Vercel (sem créditos Lovable)
```

## Como usar após um remix

Leia, nesta ordem:

1. [`deploy-vercel.md`](./deploy-vercel.md) — **🚀 deploy completo na Vercel** (recomendado para alunos).
2. [`remix-guide.md`](./remix-guide.md) — passo a passo end-to-end alternativo.
3. [`database/README.md`](./database/README.md) — setup do banco.
4. [`database/secrets.md`](./database/secrets.md) — variáveis de ambiente.
5. [`database/storage_buckets.md`](./database/storage_buckets.md) — buckets.

## Stack

- **Frontend**: TanStack Start v1 (React 19 + Vite 7) — deploy edge.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions).
- **Estilo**: Tailwind v4 com tokens em `src/styles.css`.
- **Pagamentos**: Webhook PerfectPay em `/api/public/perfectpay/webhook`.
- **Email**: outbox em `email_outbox` + templates em `email_templates`.
