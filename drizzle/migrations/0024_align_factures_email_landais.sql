UPDATE public.factures
SET client_email = 'morgane.landais@ext.groupecat.com'
WHERE client_nom = 'Landais'
  AND lower(client_email) <> 'morgane.landais@ext.groupecat.com';