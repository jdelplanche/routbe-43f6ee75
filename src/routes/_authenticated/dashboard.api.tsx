import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — the developer hub now lives at /api. */
export const Route = createFileRoute("/_authenticated/dashboard/api")({
  beforeLoad: () => {
    throw redirect({ to: "/api" });
  },
});
