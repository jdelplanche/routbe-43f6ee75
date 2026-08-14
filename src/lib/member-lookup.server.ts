/**
 * Admin-only membership debugging: everything support needs to answer
 * "why doesn't this member see their badge / blue check?".
 */

export type MemberBadgeGrant = {
  slug: string;
  name: string | null;
  awardedAt: string;
  awardedBy: string | null;
};

export type MemberDebugRecord = {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  isEarlyBeliever: boolean;
  isPaid: boolean;
  verified: boolean;
  verifiedAt: string | null;
  verifiedLegalName: string | null;
  tier: string | null;
  status: string | null;
  aliasStatus: string | null;
  createdAt: string | null;
  badges: MemberBadgeGrant[];
};

/**
 * Finds members by handle, display name, id or email (max 20 rows) and joins
 * their badge grants. Service-role only: never expose this without an admin check.
 */
export async function findMembers(query: string): Promise<MemberDebugRecord[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const term = query.trim();

  let ids: string[] | null = null;
  if (term.includes("@") && !term.endsWith("@rout.be")) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    ids = (data?.users ?? [])
      .filter((u) => (u.email ?? "").toLowerCase().includes(term.toLowerCase()))
      .map((u) => u.id);
    if (ids.length === 0) return [];
  }

  let request = supabaseAdmin
    .from("profiles")
    .select(
      "id, username, display_name, is_early_believer, is_paid, verified, verified_at, verified_legal_name, tier, status, alias_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (ids) request = request.in("id", ids);
  else if (term)
    request = request.or(
      `username.ilike.%${term}%,display_name.ilike.%${term}%,id.eq.${isUuid(term) ? term : "00000000-0000-0000-0000-000000000000"}`,
    );

  const { data: profiles, error } = await request;
  if (error) throw new Error(error.message);
  const rows = profiles ?? [];
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.id);
  const [{ data: grants }, emails] = await Promise.all([
    supabaseAdmin
      .from("user_badges")
      .select("user_id, awarded_at, awarded_by, badges(slug, name)")
      .in("user_id", userIds),
    resolveEmails(userIds),
  ]);

  const byUser = new Map<string, MemberBadgeGrant[]>();
  for (const grant of (grants ?? []) as unknown as {
    user_id: string;
    awarded_at: string;
    awarded_by: string | null;
    badges: { slug: string; name: string | null } | null;
  }[]) {
    const list = byUser.get(grant.user_id) ?? [];
    list.push({
      slug: grant.badges?.slug ?? "unknown",
      name: grant.badges?.name ?? null,
      awardedAt: grant.awarded_at,
      awardedBy: grant.awarded_by,
    });
    byUser.set(grant.user_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    email: emails.get(r.id) ?? null,
    isEarlyBeliever: Boolean(r.is_early_believer),
    isPaid: Boolean(r.is_paid),
    verified: Boolean(r.verified),
    verifiedAt: r.verified_at,
    verifiedLegalName: r.verified_legal_name,
    tier: r.tier,
    status: r.status,
    aliasStatus: r.alias_status,
    createdAt: r.created_at,
    badges: (byUser.get(r.id) ?? []).sort((a, b) => b.awardedAt.localeCompare(a.awardedAt)),
  }));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveEmails(userIds: string[]): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const map = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data?.user?.email) map.set(id, data.user.email);
      } catch {
        /* email is a nice-to-have in the debug view */
      }
    }),
  );
  return map;
}
