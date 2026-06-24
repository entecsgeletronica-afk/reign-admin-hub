INSERT INTO public.email_templates (template_key, name, subject, body_html, enabled, variables)
VALUES 
(
  'password_reset', 
  'Recuperação de Senha', 
  'Redefina sua senha em {{app_name}}', 
  '<h1>Olá {{name}}</h1><p>Você solicitou a redefinição de sua senha.</p><p>Clique no link abaixo para continuar:</p><a href="{{link}}">Redefinir senha</a>', 
  true, 
  '[]'::jsonb
),
(
  'account_confirmation', 
  'Confirmação de Conta', 
  'Bem-vindo ao {{app_name}}', 
  '<h1>Olá {{name}}</h1><p>Sua conta foi criada com sucesso.</p><p>Seus dados de acesso:</p><p>E-mail: {{email}}</p><p>Senha: {{password}}</p><a href="{{link}}">Acessar plataforma</a>', 
  true, 
  '[]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;