import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CreditCard, Landmark, Loader2 } from "lucide-react";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DONATION_PLANS, EARLY_BELIEVER_CENTS, euro, type DonationPlan } from "@/lib/profile";
import { clampContribution, contributionErrorKey, minContributionCents } from "@/lib/contributions";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import {
  IDENTITY_MISMATCH_MESSAGE,
  handleMatchesLegalName,
  legalNameError,
} from "@/lib/legal-name";
import { startSepaVerification, startVerification } from "@/lib/verification.functions";
import { SepaTransferCard } from "@/components/dashboard/SepaTransferCard";

type PaymentMethod = "stripe" | "sepa";



/** Payment states worth telling the user about, mapped to translation keys. */
const PAYMENT_NOTICES: Record<string, string | undefined> = {
  processing: "pay.status.processing",
  failed: "pay.status.failed",
  expired: "pay.status.expired",
  refunded: "pay.status.refunded",
};

const PERKS = [
  "Verified “Early Believer” badge on your public profile",
  "Your own username@rout.be forwarding address",
  "Custom domain mapping (e.g. jona.be → your ROUT profile)",
  "Price locked for life — never billed again",
];

/**
 * Early Believer checkout — one-time €3.99 lifetime verification with an
 * optional recurring “Keep ROUT Alive” donation. Flat UI: solid colours,
 * crisp borders, no gradients.
 */
export function VerificationPanel() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const start = useServerFn(startVerification);
  const startSepa = useServerFn(startSepaVerification);
  const [state, setState] = useState<{
    tier: string;
    verified: boolean;
    isEarlyBeliever: boolean;
    isPaid: boolean;
  } | null>(null);
  const [payment, setPayment] = useState<{ status: string; at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSepa, setShowSepa] = useState(false);
  const [sepaRef, setSepaRef] = useState<string | null>(null);
  const [sepaTotalCents, setSepaTotalCents] = useState<number | null>(null);

  const [handle, setHandle] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("stripe");
  const [plan, setPlan] = useState<DonationPlan>("none");
  const [customCents, setCustomCents] = useState<number | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [legalName, setLegalName] = useState("");

  const planInterval = DONATION_PLANS.find((p) => p.id === plan)?.interval ?? null;
  const planCents = plan === "none" ? 0 : (customCents ?? minContributionCents(plan));
  const planErrorKey = plan === "none" ? null : contributionErrorKey(plan, planCents);
  const planError = planErrorKey ? t(planErrorKey.key, planErrorKey.params) : null;
  // Only a monthly plan is charged together with the one-time fee today.
  const todayCents = plan === "monthly" ? planCents : plan === "yearly" ? planCents : 0;
  // The CTA must always mirror “Total today”, whichever method is selected.
  // On the manual SEPA route a recurring donation becomes a single one-off
  // contribution inside the same transfer.
  const totalTodayCents = EARLY_BELIEVER_CENTS + (method === "sepa" ? planCents : todayCents);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.rpc("get_my_profile");
      if (cancelled) return;
      setHandle(data?.username ?? "");
      setState({
        tier: data?.tier ?? "free",
        verified: Boolean(data?.verified),
        isEarlyBeliever: Boolean(data?.is_early_believer),
        isPaid: Boolean(data?.is_paid),
      });
    };

    const loadPayment = async () => {
      const { data } = await supabase
        .from("verification_payments")
        .select("status, updated_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setPayment(
        data ? { status: String(data.status), at: (data.updated_at ?? data.created_at) as string } : null,
      );
    };

    void load();
    void loadPayment();

    // A manual admin approval must flip this panel without a page refresh.
    const channel = supabase
      .channel(`profile-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => void load(),
      )
      // Stripe webhooks write here first: a clearing SEPA debit or a failed
      // charge must surface without the user reloading the dashboard.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "verification_payments",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadPayment();
          void load();
        },
      )
      .subscribe();


    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const active = Boolean(state?.isEarlyBeliever || state?.isPaid);

  const upgrade = async () => {
    setBusy(true);
    try {
      const res = await start({
        data: {
          origin: window.location.origin,
          donationPlan: plan,
          donationCents: clampContribution(plan, planCents),
          legalName,
        },
      });
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      if (res.reason === "email_unconfirmed") notifyError(t("pay.err.email"));
      else if (res.reason === "stripe_not_configured") notifyInfo(t("pay.err.stripe"));
      else notifyError(t("pay.err.generic"));
    } catch {
      notifyError(t("pay.err.generic"));
    } finally {
      setBusy(false);
    }
  };

  /** SEPA route: the legal name is mandatory here too. */
  const requestSepa = async () => {
    setBusy(true);
    try {
      const res = await startSepa({
        data: {
          donationPlan: plan,
          donationCents: clampContribution(plan, planCents),
          legalName,
        },
      });
      if (res.ok) {
        setSepaRef(res.reference ?? null);
        setSepaTotalCents(res.totalCents ?? null);
        setShowSepa(true);
        setNameOpen(false);

      } else {
        notifyError(t("pay.err.sepa"));
      }
    } catch {
      notifyError(t("pay.err.sepa"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {active ? t("eb.titleActive") : t("eb.title")}
        </h2>
        {active && (
          <span className="inline-flex items-center gap-1.5 border border-primary bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
            <BadgeCheck className="h-3.5 w-3.5" /> {t("eb.badge")}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Verified profiles live at{" "}
        <strong className="font-mono">rout.be/@{handle || "handle"}</strong>. Free profiles stay at{" "}
        <strong className="font-mono">rout.be/u/@{handle || "handle"}</strong>. Verification only
        becomes active once your payment is confirmed.
      </p>

      {/* Live payment state, driven by the Stripe webhook via realtime. */}
      {payment && !active && PAYMENT_NOTICES[payment.status] && (
        <p
          role="status"
          className={`rounded-xl border p-3 text-xs ${
            payment.status === "processing"
              ? "border-border bg-muted/50 text-muted-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {t(PAYMENT_NOTICES[payment.status]!)}{" "}
          <span className="opacity-70">({formatDateTime(payment.at, locale)})</span>
        </p>
      )}


      {!active && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* Line item */}
          <div className="flex items-baseline justify-between gap-3 border-b border-border p-4">
            <div>
              <p className="text-sm font-semibold">{t("eb.lineItem")}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("eb.lineNote")}
              </p>
            </div>
            <span className="text-2xl font-bold tabular-nums">{euro(EARLY_BELIEVER_CENTS)}</span>
          </div>

          <ul className="space-y-1 border-b border-border p-4 text-[11px] text-muted-foreground">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden>·</span>
                {p}
              </li>
            ))}
          </ul>

          {/* Donation selector */}
          <fieldset className="border-b border-border p-4">
            <legend className="sr-only">{t("contrib.legend")}</legend>
            <p className="mb-2 text-xs font-semibold">{t("contrib.title")}</p>
            <div
              className="grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label={t("contrib.legend")}
            >
              {DONATION_PLANS.map((p) => {
                const selected = plan === p.id;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-[11px] transition-colors ${
                      selected
                        ? "border-foreground bg-muted"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="donation-plan"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      checked={selected}
                      onChange={() => {
                        setPlan(p.id);
                        setCustomCents(null);
                      }}
                    />
                    <span>
                      <span className="block font-semibold text-foreground">
                        {t(`contrib.plan.${p.id}`)}
                      </span>
                      <span className="block text-muted-foreground">
                        {t(`contrib.plan.${p.id}.note`)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {plan !== "none" && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="contribution" className="text-[11px] font-semibold">
                  {t(planInterval === "month" ? "contrib.amount.month" : "contrib.amount.year", {
                    min: euro(minContributionCents(plan)),
                  })}
                </Label>
                <Input
                  id="contribution"
                  type="number"
                  min={minContributionCents(plan) / 100}
                  step="0.5"
                  value={(planCents / 100).toString()}
                  onChange={(e) =>
                    setCustomCents(
                      e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                    )
                  }
                  className="input-field h-10 w-40 rounded-xl"
                />
                {planError && <p className="text-[11px] text-destructive">{planError}</p>}
              </div>
            )}
          </fieldset>

          {/* Payment method */}
          <div
            className="grid gap-2 border-b border-border p-4 sm:grid-cols-2"
            role="radiogroup"
            aria-label={t("pay.method")}
          >
            {[
              {
                id: "stripe" as const,
                icon: CreditCard,
                label: t("pay.card"),
                note: t("pay.card.note"),
              },
              {
                id: "sepa" as const,
                icon: Landmark,
                label: t("pay.sepa"),
                note: t("pay.sepa.note"),
              },
            ].map(({ id, icon: Icon, label, note }) => {
              const selected = method === id;
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-[11px] transition-colors ${
                    selected
                      ? "border-foreground bg-muted"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    className="h-3.5 w-3.5"
                    checked={selected}
                    onChange={() => setMethod(id)}
                  />
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-semibold text-foreground">{label}</span>
                    <span className="block text-muted-foreground">{note}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Summary + CTA */}
          <div className="space-y-3 p-4">
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt>{t("contrib.line.oneTime")}</dt>
                <dd className="tabular-nums">{euro(EARLY_BELIEVER_CENTS)}</dd>
              </div>
              {planCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>
                    {method === "sepa"
                      ? "Donation (one-off via transfer)"
                      : t(planInterval === "month" ? "contrib.line.monthly" : "contrib.line.yearly")}
                  </dt>
                  <dd className="tabular-nums">
                    {euro(planCents)}
                    {method === "sepa"
                      ? ""
                      : ` / ${t(planInterval === "month" ? "contrib.per.month" : "contrib.per.year")}`}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 text-sm font-bold">
                <dt>{t("contrib.total")}</dt>
                <dd className="tabular-nums" data-testid="total-today">
                  {euro(totalTodayCents)}
                </dd>
              </div>
            </dl>

            {method === "sepa" && planCents > 0 && (
              <p className="rounded-lg border border-border bg-muted/50 p-2 text-[11px] text-muted-foreground">
                A recurring donation can't be collected over a manual bank transfer. Your{" "}
                {euro(planCents)} is included once in this transfer; switch to the card route for a
                recurring “Keep ROUT Alive” donation.
              </p>
            )}

            {method === "stripe" ? (
              <Button
                className="h-11 w-full rounded-xl text-sm font-semibold"
                disabled={busy || Boolean(planError)}
                onClick={() => setNameOpen(true)}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("pay.cta.card", { total: euro(totalTodayCents) })}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl text-sm font-semibold"
                disabled={Boolean(planError)}
                onClick={() => {
                  if (showSepa) {
                    setShowSepa(false);
                    return;
                  }
                  setNameOpen(true);
                }}
              >
                {showSepa ? t("pay.cta.hide") : t("pay.cta.sepa", { total: euro(totalTodayCents) })}
              </Button>
            )}


            {/* Mandatory legal-name step — verification is identity-bound. */}
            <Dialog open={nameOpen} onOpenChange={setNameOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("legal.title")}</DialogTitle>
                  <DialogDescription>{t("legal.desc")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="legal-name" className="text-xs font-semibold">
                    {t("legal.label")}
                  </Label>
                  <Input
                    id="legal-name"
                    value={legalName}
                    autoComplete="name"
                    placeholder="Jona Delplanche"
                    onChange={(e) => setLegalName(e.target.value)}
                    className="input-field h-10 rounded-xl"
                  />
                  {legalName.trim() !== "" && legalNameError(legalName) && (
                    <p className="text-[11px] text-destructive">{legalNameError(legalName)}</p>
                  )}
                  {handle &&
                    legalName.trim() !== "" &&
                    !legalNameError(legalName) &&
                    !handleMatchesLegalName(handle, legalName) && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {IDENTITY_MISMATCH_MESSAGE} Your handle{" "}
                        <span className="font-mono">@{handle}</span> does not match — you may be
                        asked to change it after verification.
                      </p>
                    )}
                </div>
                <DialogFooter>
                  <Button
                    className="h-11 w-full rounded-xl text-sm font-semibold"
                    disabled={busy || Boolean(legalNameError(legalName))}
                    onClick={() => void (method === "stripe" ? upgrade() : requestSepa())}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {method === "stripe"
                      ? t("pay.continue.card", { total: euro(totalTodayCents) })
                      : t("pay.continue.sepa")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {method === "sepa" && showSepa && (
              <SepaTransferCard
                reference={sepaRef ?? `ROUT-${(handle || "handle").toUpperCase()}`}
                amountCents={sepaTotalCents ?? totalTodayCents}
                status={
                  active ? "paid" : payment?.status === "processing" ? "processing" : "pending"
                }
              />
            )}

          </div>
        </div>
      )}
    </section>
  );
}
