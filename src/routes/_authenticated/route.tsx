import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gate for every signed-in surface (dashboard, settings, domains, admin).
 *
 * `ssr: false` is required: the Supabase session lives in localStorage, which
 * the server cannot read — gating server-side would loop on a hard refresh.
 * The blocked URL is preserved so the user lands back where they intended.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
        replace: true,
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
