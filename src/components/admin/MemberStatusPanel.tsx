import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, Award, BadgeCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import { lookupMembers } from "@/lib/admin.functions";
import type { MemberDebugRecord } from "@/lib/member-lookup.server";

/**
 * Support/debug view: shows the raw membership state (Early Believer flag,
 * verification fields, badge grants) behind the public Benefits cards.
 */
export function MemberStatusPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberDebugRecord[] | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const res = await lookupMembers({ data: { query } });
      setMembers(res.members as MemberDebugRecord[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by handle, name, email or user id"
            className="pl-9"
            aria-label="Search members"
          />
        </div>
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Look up
        </Button>
      </form>

      {members === null ? (
        <p className="text-sm text-muted-foreground">
          Search a member to inspect their Early Believer flag, verification fields and badge
          grants.
        </p>
      ) : members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No members matched that search.
        </p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {m.displayName || m.username || "Unnamed member"}
                </p>
                {m.username ? (
                  <span className="text-xs text-muted-foreground">@{m.username}</span>
                ) : null}
                <Badge variant={m.isEarlyBeliever ? "default" : "outline"} className="gap-1">
                  <Award className="h-3 w-3" aria-hidden /> Early Believer:{" "}
                  {m.isEarlyBeliever ? "yes" : "no"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" aria-hidden /> Blue mark
                </Badge>
                <Badge variant={m.verified ? "default" : "outline"} className="gap-1">
                  <ShieldCheck className="h-3 w-3" aria-hidden /> Verified:{" "}
                  {m.verified ? "yes" : "no"}
                </Badge>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <Row label="User id" value={m.id} mono />
                <Row label="Email" value={m.email} mono />
                <Row
                  label="Alias"
                  value={m.username ? `${m.username}@rout.be (${m.aliasStatus ?? "—"})` : null}
                />
                <Row label="Tier" value={m.tier} />
                <Row label="Status" value={m.status} />
                <Row label="Paid" value={m.isPaid ? "yes" : "no"} />
                <Row label="Verified at" value={m.verifiedAt} />
                <Row label="Legal name" value={m.verifiedLegalName} />
                <Row label="Created" value={m.createdAt} />
              </dl>

              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Badge grants ({m.badges.length})
                </p>
                {m.badges.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No badges granted yet — sign-in triggers the Early Believer baseline.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {m.badges.map((b) => (
                      <li key={`${b.slug}-${b.awardedAt}`}>
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <Mail className="h-3 w-3 opacity-0" aria-hidden />
                          {b.name ?? b.slug} · {new Date(b.awardedAt).toLocaleDateString()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
