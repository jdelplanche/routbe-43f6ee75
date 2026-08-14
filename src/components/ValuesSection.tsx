import { ShieldCheck, PenTool, GitBranch, Mail, Award, BadgeCheck, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Link } from "@/lib/router-compat";
import { useMemberStatus } from "@/hooks/useMemberStatus";

type Access = "free" | "verify";

const CARDS = [
  { key: "sovereign", Icon: ShieldCheck, access: "free" },
  { key: "vector", Icon: PenTool, access: "free" },
  { key: "open", Icon: GitBranch, access: "free" },
  { key: "identity", Icon: Mail, access: "free" },
  { key: "badge", Icon: Award, access: "free" },
  { key: "verify", Icon: Lock, access: "verify" },
] as const satisfies readonly { key: string; Icon: typeof Mail; access: Access }[];

export function ValuesSection() {
  const { t } = useI18n();
  const {
    data: status,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useMemberStatus();


  return (
    <section id="why-rout" className="border-t border-border">
      <div className="container mx-auto px-4 py-14">
        <div className="my-12 rounded-3xl bg-neutral-900 p-4 text-neutral-100 sm:p-12">
          <div className="max-w-2xl">
            <p className="eyebrow text-neutral-400">{t("values.eyebrow")}</p>
            <h2 className="mt-2 font-display text-[32px] leading-tight text-neutral-50 sm:text-[40px]">
              {t("values.heading")}
            </h2>
            <p className="mt-3 text-sm text-neutral-400">{t("values.subheading")}</p>
          </div>

          {status ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-100">
                <Award className="h-3.5 w-3.5" strokeWidth={2} />
                {status.earlyBeliever
                  ? t("values.status.you.earlyBeliever")
                  : t("values.status.you.earlyBelieverPending")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-300">
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                {t("values.status.you.blueMark")}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  status.verified
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                {status.verified
                  ? t("values.status.you.verified")
                  : t("values.status.you.unverified")}
              </span>
              {status.aliasEmail ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-100">
                  <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                  {status.aliasEmail}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 space-y-3 sm:grid-cols-2 sm:space-y-0 lg:grid-cols-3">
            {CARDS.map(({ key, Icon, access }) => (
              <article
                key={key}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-700/50 bg-neutral-800/60 p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-700/60">
                    <Icon className="h-4.5 w-4.5 text-neutral-100" strokeWidth={1.7} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      access === "free"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {access === "free"
                      ? t("values.status.free")
                      : t("values.status.needsVerification")}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-neutral-50">
                  {t(`values.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {t(`values.${key}.body`)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/manifesto"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
            >
              {t("values.manifesto")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
