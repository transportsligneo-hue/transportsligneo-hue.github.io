import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // Browser-side gate: blocks the auth shell from rendering before
    // the Supabase session is hydrated. Edge/RLS still enforces real auth
    // for any data access; this prevents flashes of authenticated UI.
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: () => <Outlet />,
});
