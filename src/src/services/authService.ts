import { supabase } from "./supabaseClient";

export type AuthUser = {
  username: string;
  name: string;
  role: "admin" | "worker";
  organisationId?: string | null;
  organisationPlan?: "free" | "pro" | "premium";
  phone?: string;
  isNewUser?: boolean; // true when account was just created via OTP
};

const allowedOrg = (org: any) =>
  org && org.status === "approved" && org.access_enabled !== false;

// ─────────────────────────────────────────────────────────────────────────────
// Password-based login (unchanged — works for existing accounts)
// ─────────────────────────────────────────────────────────────────────────────
export async function loginWithCredentials(
  username: string,
  password: string
): Promise<AuthUser | null> {
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!u || !p) return null;

  // Org admins
  try {
    const { data } = await supabase
      .from("org_admins")
      .select("id, username, password, name, organisation_id, organisations(status, access_enabled)")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();
    if (data && allowedOrg((data as any).organisations)) {
      return {
        username: (data as any).username,
        name: (data as any).name || (data as any).username,
        role: "admin",
        organisationId: (data as any).organisation_id ?? null,
        organisationPlan: "free",
      };
    }
  } catch (_) {}

  // Workers
  try {
    const { data } = await supabase
      .from("workers")
      .select("id, username, password, name, role, organisation_id, organisations(status, access_enabled)")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();
    if (data && allowedOrg((data as any).organisations)) {
      return {
        username: (data as any).username,
        name: (data as any).name || (data as any).username,
        role: ((data as any).role as "admin" | "worker") || "worker",
        organisationId: (data as any).organisation_id ?? null,
        organisationPlan: "free",
      };
    }
  } catch (_) {}

  // Vendors
  try {
    const { data } = await supabase
      .from("vendors")
      .select("id, username, password, name, firm_name, organisation_id, organisations(status, access_enabled)")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();
    if (data && allowedOrg((data as any).organisations)) {
      return {
        username: (data as any).username,
        name: (data as any).name || (data as any).firm_name || (data as any).username,
        role: "worker",
        organisationId: (data as any).organisation_id ?? null,
        organisationPlan: "free",
      };
    }
  } catch (_) {}

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone OTP — LOGIN only. Finds existing account. Returns null if not found.
// Never creates a new account.
// ─────────────────────────────────────────────────────────────────────────────
export async function findUserByPhone(phone: string): Promise<AuthUser | null> {
  const digits10 = phone.replace(/\D/g, "").slice(-10);

  // Check org_admins
  try {
    const { data } = await supabase
      .from("org_admins")
      .select("id, username, name, organisation_id, phone, subscription_tier")
      .ilike("phone", `%${digits10}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        username: (data as any).username,
        name: (data as any).name || (data as any).username,
        role: "admin",
        organisationId: (data as any).organisation_id ?? null,
        organisationPlan: ((data as any).subscription_tier as any) ?? "free",
        phone,
        isNewUser: false,
      };
    }
  } catch (_) {}

  // Check workers
  try {
    const { data } = await supabase
      .from("workers")
      .select("id, username, name, role, organisation_id, phone")
      .ilike("phone", `%${digits10}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        username: (data as any).username,
        name: (data as any).name || (data as any).username,
        role: ((data as any).role as "admin" | "worker") || "worker",
        organisationId: (data as any).organisation_id ?? null,
        organisationPlan: "free",
        phone,
        isNewUser: false,
      };
    }
  } catch (_) {}

  return null; // ← Account NOT found — caller shows "No account found. Please register."
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone OTP — REGISTER only. Creates a new account ONLY if phone doesn't exist.
// Returns existing account with isNewUser=false if phone already registered.
// ─────────────────────────────────────────────────────────────────────────────
export async function registerUserByPhone(phone: string, payload?: any): Promise<AuthUser> {
  const digits10 = phone.replace(/\D/g, "").slice(-10);

  // First check if account already exists
  const existing = await findUserByPhone(phone);
  if (existing) {
    return { ...existing, isNewUser: false };
  }

  // Create a new isolated organisation for this user
  let organisationId: string | null = null;
  try {
    const { data: newOrg, error: orgError } = await supabase
      .from("organisations")
      .insert({
        name: payload?.orgName || `${digits10}'s Business`,
        status: "approved",
        access_enabled: true,
      })
      .select("id")
      .single();

    if (!orgError && newOrg) {
      organisationId = (newOrg as any).id;
    }
  } catch (_) {}

  // Create the org_admin linked to the new org
  try {
    const { data: created, error } = await supabase
      .from("org_admins")
      .insert({
        username: payload?.email || digits10,
        name: payload?.orgName || digits10,
        phone: digits10,
        password: payload?.password || digits10,
        ...(organisationId ? { organisation_id: organisationId } : {}),
      })
      .select("id, username, name, organisation_id")
      .single();

    if (!error && created) {
      // Seed settings with phone number so it pre-fills
      if (organisationId) {
        supabase.from("settings").insert({
          organisation_id: organisationId,
          business_name: payload?.brandName || payload?.orgName || "",
          address: payload?.address || "",
          gst_number: payload?.gst || "",
          email: payload?.email || "",
          phone: digits10,
          whatsapp: digits10,
        }).then(() => {});
      }

      return {
        username: (created as any).username,
        name: (created as any).name,
        role: "admin",
        organisationId: (created as any).organisation_id ?? null,
        organisationPlan: payload?.plan || "free",
        phone,
        isNewUser: true,
      };
    }
  } catch (_) {}

  // Fallback — DB failed but still give them a session
  return {
    username: digits10,
    name: digits10,
    role: "admin",
    organisationId: null,
    organisationPlan: "free",
    phone,
    isNewUser: true,
  };
}

// Keep for backward compatibility
export async function loginWithPhone(phone: string): Promise<AuthUser> {
  return registerUserByPhone(phone);
}

// end of authService.ts
