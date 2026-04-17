/**
 * guardUtils.ts
 * Central guard helpers to enforce tenant isolation.
 * Import `requireOrgId` in every service before any DB query.
 */

/**
 * Throws a descriptive error if orgId is falsy.
 * Use this as the first gate for every tenant-scoped DB query.
 *
 * @example
 *   const orgId = requireOrgId(organisationId);
 *   query = query.eq("organisation_id", orgId);
 */
export function requireOrgId(orgId: string | null | undefined): string {
  if (!orgId) {
    const err = new Error(
      "[Security] Organisation ID is required but was not provided. " +
      "This call was blocked to prevent cross-tenant data leakage."
    );
    console.error(err.message);
    throw err;
  }
  return orgId;
}
