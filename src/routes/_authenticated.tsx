import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // Gate UX instantané : lit la session locale au lieu d'appeler le réseau.
    // Les accès réels restent protégés côté backend/RLS ; ici on évite surtout
    // le spinner blanc au retour de l'appareil photo mobile pendant l'EDL.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: () => <Outlet />,
});
