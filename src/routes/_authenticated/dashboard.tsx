import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingSkeleton,
  component: () => <Outlet />,
});
