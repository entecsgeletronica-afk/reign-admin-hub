
-- 1) email_templates: remove leitura geral por authenticated
DROP POLICY IF EXISTS "Authenticated can view email templates" ON public.email_templates;
-- A política "Admins can manage email templates" (ALL) já cobre SELECT para admins.

-- 2) user_rewards: remover INSERT por usuários (deve ser concedido só via server-side/admin)
DROP POLICY IF EXISTS "Users insert own rewards" ON public.user_rewards;

-- Permitir que admins concedam recompensas
CREATE POLICY "Admins insert rewards"
  ON public.user_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Realtime: adicionar RLS em realtime.messages com escopo por usuário
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas anteriores idempotentemente
DROP POLICY IF EXISTS "Users receive own realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Users send own realtime messages" ON realtime.messages;

-- Cada usuário só pode receber mensagens de canais cujo tópico contenha o seu user_id
CREATE POLICY "Users receive own realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      realtime.topic() LIKE ('user:' || auth.uid()::text || '%')
      OR realtime.topic() LIKE ('%:' || auth.uid()::text)
      OR realtime.topic() = auth.uid()::text
    )
  );

-- Cada usuário só pode enviar mensagens em canais do próprio escopo
CREATE POLICY "Users send own realtime messages"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      realtime.topic() LIKE ('user:' || auth.uid()::text || '%')
      OR realtime.topic() LIKE ('%:' || auth.uid()::text)
      OR realtime.topic() = auth.uid()::text
    )
  );
