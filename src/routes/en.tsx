import { createFileRoute } from "@tanstack/react-router";
import { socialImageMeta } from "@/lib/site";
import { useEffect } from "react";
import Index from "@/pages/Index";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/en")({
  head: () => ({
    meta: [
      { title: "ROUT — Custom QR Code Studio" },
      {
        name: "description",
        content:
          "Design print-ready QR codes: custom colours, shapes, center logo, SEPA payments and scan analytics.",
      },
      { property: "og:title", content: "ROUT — Custom QR Code Studio" },
      {
        property: "og:description",
        content: "Print-ready QR codes with custom colours, shapes, logo and scan analytics.",
      },
      ...socialImageMeta,
    ],
  }),
  component: EnPage,
});

function EnPage() {
  const { setLocale } = useI18n();
  useEffect(() => {
    setLocale("en");
  }, [setLocale]);
  return <Index />;
}
