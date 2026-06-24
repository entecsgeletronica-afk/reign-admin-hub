
DROP POLICY IF EXISTS "Admins manage offer codes" ON public.commercial_offer_codes;
CREATE POLICY "Admins manage offer codes"
ON public.commercial_offer_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage plan-product grants" ON public.plan_product_grants;
CREATE POLICY "Admins manage plan-product grants"
ON public.plan_product_grants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
