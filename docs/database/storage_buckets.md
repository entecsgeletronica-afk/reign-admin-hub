# Storage Buckets

Todos os buckets são criados via migrations e restaurados automaticamente
ao rodar `backup-sql.sql`.

| Bucket | Público | Uso |
|---|---|---|
| `branding` | ✅ | Logo, favicon, hero da marca (Admin → Branding). |
| `story-covers` | ✅ | Capas de histórias bíblicas. |
| `story-pages-lineart` | ✅ | Line-art (PNG transparente) de páginas para colorir. |
| `story-pages-preview` | ✅ | Thumbs de preview das páginas. |
| `story-pages-samples` | ✅ | Amostras coloridas de referência. |
| `avatars` | ✅ | Avatares dos usuários. |
| `email-assets` | ✅ | Imagens embutidas em templates de email. |
| `user-artworks` | ❌ | Renders das artes salvas pelos usuários. |
| `catalog-covers` | ✅ | Capas/heros de produtos do catálogo. |
| `ebook-files` | ❌ | PDFs de e-books (acesso via signed URL + RLS). |

## Políticas

Buckets públicos: leitura aberta, escrita só por admins ou pelo dono
(quando aplicável). Buckets privados (`user-artworks`, `ebook-files`):
acesso por signed URL gerada no servidor após verificação de
`user_has_product_access()`.

## Verificar após restauração

No painel **Storage** do Supabase, confirme que todos os 10 buckets
estão presentes. Se algum estiver faltando, rode novamente a migration
que cria buckets (qualquer arquivo em `migrations/` que contenha
`storage.buckets`).
