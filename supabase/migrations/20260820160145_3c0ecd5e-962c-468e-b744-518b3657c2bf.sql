insert into public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
values (
  'mission_terminee',
  'Mission MIS-TLG-2026-#104 terminée',
  '6 rue du pont libert, 37520 La Riche → Axione le Mans (72) · RENAULT Scenic · HL-083-YP · Convoyeur : Olivier Gourlaouen — dossier complet transmis, en attente de validation.',
  '/admin/missions/9a028dcd-f883-47b5-a726-0af5a0588463',
  'attribution',
  '9a028dcd-f883-47b5-a726-0af5a0588463'::uuid,
  '{"numero":"MIS-TLG-2026-#104","retroactif":true}'::jsonb
);

select public.enqueue_email('transactional_emails', jsonb_build_object(
  'template_name','mission-terminee-admin',
  'recipient_email','contact@transportsligneo.fr',
  'idempotency_key','mission-terminee-admin-9a028dcd-f883-47b5-a726-0af5a0588463',
  'template_data', jsonb_build_object(
    'numero','MIS-TLG-2026-#104',
    'trajet','6 rue du pont libert, 37520 La Riche → Axione le Mans, Le Cormier, 72230 Mulsanne',
    'vehicule','RENAULT Scenic',
    'immatriculation','HL-083-YP',
    'convoyeur','Olivier Gourlaouen',
    'client','Morgane Landais',
    'terminee_le','20/08/2026 17:57',
    'lien','https://transportsligneo.fr/admin/missions/9a028dcd-f883-47b5-a726-0af5a0588463'
  )
));