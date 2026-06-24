# Tabelas (schema `public`)

51 tabelas. Todas têm RLS ligada.

## Identidade & roles

| Tabela | Propósito |
|---|---|
| `profiles` | Dados públicos do usuário (display_name, avatar). |
| `user_roles` | Roles (`admin`, `super_admin`, `moderator`, `user`). |
| `active_sessions` | Sessões ativas para enforcement de single-session. |
| `protected_settings` | Configs que só super_admin edita. |
| `security_audit_logs` | Log append-only de ações sensíveis. |

## Catálogo

| Tabela | Propósito |
|---|---|
| `catalog_sections` | Seções da home (carrosséis). |
| `catalog_products` | Produtos (drawing/course/ebook/download). |
| `catalog_user_favorites` | Favoritos por usuário. |
| `home_settings` | Hero + featured product por variação. |
| `user_recent_products` | "Continuar lendo" — últimos produtos abertos. |

## Áreas de membro (multi-tenant)

| Tabela | Propósito |
|---|---|
| `member_area_variations` | Áreas de membro (uma por marca/produto). |
| `member_area_domains` | Subdomínios/domínios customizados por área. |

## Ofertas comerciais & vendas

| Tabela | Propósito |
|---|---|
| `commercial_offers` | Ofertas (gateway + token). |
| `commercial_offer_codes` | Códigos externos do gateway por oferta. |
| `commercial_offer_products` | Produtos liberados por oferta. |
| `plans` | Planos de assinatura. |
| `plan_product_grants` | Produtos liberados por plano. |
| `sales` | Eventos de venda do gateway. |
| `subscriptions` | Assinaturas ativas. |
| `user_orders` | Pedidos do usuário. |
| `user_product_entitlements` | Acesso ativo do usuário a produtos. |
| `access_resend_log` | Log de reenvios de acesso por admin. |

## E-books

| Tabela | Propósito |
|---|---|
| `ebook_modules` | Módulos (quando `ebook_mode='modules'`). |
| `ebook_files` | PDFs (file_path no bucket `ebook-files`). |
| `ebook_progress` | Progresso de leitura por usuário. |

## Cursos

| Tabela | Propósito |
|---|---|
| `course_modules` | Módulos do curso. |
| `course_lessons` | Aulas (vídeo YouTube + body + PDF + complementar). |
| `course_lesson_progress` | Progresso por aula. |

## Histórias / Desenhos para colorir

| Tabela | Propósito |
|---|---|
| `stories` | Histórias bíblicas. |
| `stories_pages` | Páginas (lineart + preview + sample colorido). |
| `story_categories` | Categorias. |
| `story_categories_map` | M2M stories ↔ categorias. |
| `story_completions` | Marca quando usuário concluiu uma história. |
| `story_cover_overrides` | Override admin de capa por slug. |
| `user_story_progress` | Progresso geral por história. |
| `user_page_progress` | Progresso por página. |
| `user_artworks` | Renders salvos pelo usuário. |
| `user_favorites` | Favoritos de stories/páginas (legacy). |

## Engajamento

| Tabela | Propósito |
|---|---|
| `achievements` | Conquistas configuráveis. |
| `user_achievements` | Conquistas desbloqueadas por usuário. |
| `user_rewards` | Recompensas concedidas (XP, badges, etc.). |
| `user_streaks` | Sequências de uso (streaks). |
| `user_recent_activity` | Feed de atividade recente. |
| `user_notification_reads` | Marcação de "lido" para notificações. |

## Branding & configurações globais

| Tabela | Propósito |
|---|---|
| `branding_settings` | Cores, logo, app_name (legado global). |
| `app_settings` | Idioma padrão + sender_email. |
| `app_settings_kv` | Key/value flexível. |

## Email

| Tabela | Propósito |
|---|---|
| `email_templates` | Templates HTML (`access_granted`, etc.). |
| `email_outbox` | Fila de envio (status: pending/sent/failed). |

## Webhooks

| Tabela | Propósito |
|---|---|
| `webhook_integrations` | Configurações de webhook por área. |
| `webhook_events` | Log de eventos recebidos. |
