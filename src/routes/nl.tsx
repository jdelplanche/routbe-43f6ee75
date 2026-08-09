import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import { useEffect } from "react";
import Index from "@/pages/Index";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/nl")({
  head: () => ({
    meta: [
      { title: "ROUT — QR-codegenerator met eigen stijl" },
      {
        name: "description",
        content:
          "Maak print-klare QR-codes: eigen kleuren, vormen, logo in het midden, SEPA-betalingen en scananalytics.",
      },
      { property: "og:title", content: "ROUT — QR-codegenerator met eigen stijl" },
      {
        property: "og:description",
        content: "Print-klare QR-codes met eigen kleuren, vormen, logo en scananalytics.",
      },
      ...socialImageMeta,
    ],
  }),
  component: NlPage,
});

function NlPage() {
  const { setLocale } = useI18n();
  useEffect(() => {
    setLocale("nl");
  }, [setLocale]);
  return <Index />;
}
