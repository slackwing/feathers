/* Roles — who this site lets in, and how far. One place, read by the OS and
   the apps alike (and mirrored by hobby-server's IsMember / IsAnonymous). */

/** The website this OS is: a signed-in account needs a role here to get past the gate. */
export const SITE = "hxh";

/** The shared "View site anonymously" account (hobby-server changeset 008): its password is public by design. */
export const ANONYMOUS = { username: "anonymous", password: "anonymous" };

/** An anonymous viewer (Andrew, 2026-09-28): every role it holds on SITE is "anonymous" — it may look, not act.
    The server refuses its actions too; the UI only stops offering them. */
export function anonymous(user) {
  const roles = (user?.roles || []).filter(r => r.website === SITE);
  return roles.length > 0 && roles.every(r => r.role === "anonymous");
}
