-- Gate course content behind product access (entitlement check)
DROP POLICY IF EXISTS "Anyone can view course modules" ON public.course_modules;
CREATE POLICY "Users with access view course modules"
  ON public.course_modules
  FOR SELECT
  TO authenticated
  USING (public.user_has_product_access(auth.uid(), product_id));

DROP POLICY IF EXISTS "Anyone can view published course lessons" ON public.course_lessons;
CREATE POLICY "Users with access view published course lessons"
  ON public.course_lessons
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.course_modules m
        WHERE m.id = course_lessons.module_id
          AND public.user_has_product_access(auth.uid(), m.product_id)
      )
    )
  );

-- Restrict protected_settings reads to authenticated users only
DROP POLICY IF EXISTS "Anyone can view protected settings" ON public.protected_settings;
CREATE POLICY "Authenticated can view protected settings"
  ON public.protected_settings
  FOR SELECT
  TO authenticated
  USING (true);