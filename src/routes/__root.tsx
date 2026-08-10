import "@/lib/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "../styles.css";
import { ThemeProvider } from "@/hooks/useTheme";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppRecovery } from "@/hooks/useAppRecovery";
import { assetUrl } from "@/lib/site";

function NotFoundComponent() {
  return null;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {}, [error]);

  return null;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ROUT — QR Code Studio" },
      { name: "description", content: "Design print-ready QR codes with custom styling, frames and scan analytics." },
      { name: "author", content: "ROUT" },
      { property: "og:title", content: "ROUT — QR Code Studio" },
      { property: "og:description", content: "Design print-ready QR codes with custom styling, frames and scan analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: assetUrl("/favicon.png") },
      { rel: "apple-touch-icon", href: assetUrl("/apple-touch-icon.png") },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const generation = useAppRecovery();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <ErrorBoundary resetKey={generation}>
                <div key={generation} className="contents"><Outlet /></div>
              </ErrorBoundary>
            </AuthProvider>
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
