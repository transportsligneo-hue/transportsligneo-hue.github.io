-- Remove redundant permissive UPDATE policy that allowed convoyeurs to bypass
-- statut transition validation by updating any column (statut, is_public, etc.)
-- with arbitrary values. The "Driver can update own attribution" policy already
-- permits convoyeurs to update their attribution (including options_completion,
-- etape_courante, pdf_share_client) as long as statut stays unchanged or follows
-- a validated transition via can_driver_update_attribution().
DROP POLICY IF EXISTS "Convoyeurs update own options_completion" ON public.attributions;