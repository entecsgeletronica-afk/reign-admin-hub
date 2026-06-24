
-- ============================================================================
-- Security hardening: fix all critical and high-priority security findings
-- ============================================================================

-- 1) protected_settings: remover leitura pública anônima.
--    Apenas usuários autenticados podem ler (sidebar admin / home logada).
DROP POLICY IF EXISTS "Anyone can view protected settings" ON public.protected_settings;

CREATE POLICY "Authenticated users can view protected settings"
ON public.protected_settings
FOR SELECT
TO authenticated
USING (true);

-- 2) course_lessons: bloquear leitura sem entitlement.
--    Substitui a policy permissiva por uma que checa acesso ao produto.
DROP POLICY IF EXISTS "Anyone can view published course lessons" ON public.course_lessons;

CREATE POLICY "Users view accessible course lessons"
ON public.course_lessons
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1
    FROM public.course_modules m
    WHERE m.id = course_lessons.module_id
      AND public.user_has_product_access(auth.uid(), m.product_id)
  )
);

-- Admins continuam vendo tudo (policy "Admins manage course lessons" já cobre ALL).

-- 3) app_settings_kv: o e-mail seed do admin é PII e estava público.
--    Restringir leitura desse key apenas para admins; demais keys continuam
--    legíveis por usuários autenticados (são configs gerais não-sensíveis).
DROP POLICY IF EXISTS "Anyone can view app settings kv" ON public.app_settings_kv;

CREATE POLICY "Authenticated users view non-sensitive app settings"
ON public.app_settings_kv
FOR SELECT
TO authenticated
USING (
  key NOT IN ('seed_admin_email')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
