import { supabase } from "./supabaseClient";

export type AuthUser = {
  id?: string;
  username: string;
  name: string;
  role: "admin" | "worker";
  organisationId?: string | null;
  organisationPlan?: "free" | "pro" | "premium";
  phone?: string;
  isNewUser?: boolean; // true when account was just created via OTP
};

const allowedOrg = (org: any, orgId: string | null | undefined) =>
  !!orgId && org && org.status === "approved" && org.access_enabled !== false;

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
    const { data: adminData, error: adminErr } = await supabase
      .from("org_admins")
      .select("id, username, password, name, organisation_id")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();

    if (adminErr) {
      console.error("DB Error (org_admins login):", adminErr);
      throw new Error(`Database error: ${adminErr.message}`);
    }

    if (adminData) {
      return {
        id: (adminData as any).id,
        username: (adminData as any).username,
        name: (adminData as any).name || (adminData as any).username,
        role: "admin",
        organisationId: (adminData as any).organisation_id,
        organisationPlan: "free",
      };
    }
  } catch (err: any) {
    throw err;
  }

  // Workers
  try {
    const { data: workerData, error: workerErr } = await supabase
      .from("workers")
      .select("id, username, password, name, role, organisation_id")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();

    if (workerErr) {
      console.error("DB Error (workers login):", workerErr);
      throw new Error(`Database error: ${workerErr.message}`);
    }

    if (workerData) {
      return {
        id: (workerData as any).id,
        username: (workerData as any).username,
        name: (workerData as any).name || (workerData as any).username,
        role: ((workerData as any).role as "admin" | "worker") || "worker",
        organisationId: (workerData as any).organisation_id,
        organisationPlan: "free",
      };
    }
  } catch (err: any) {
    throw err;
  }

  // Vendors
  try {
    const { data: vendorData, error: vendorErr } = await supabase
      .from("vendors")
      .select("id, username, password, name, firm_name, organisation_id")
      .eq("username", u)
      .eq("password", p)
      .limit(1)
      .maybeSingle();

    if (vendorErr) {
      console.error("DB Error (vendors login):", vendorErr);
      throw new Error(`Database error: ${vendorErr.message}`);
    }

    if (vendorData) {
      return {
        id: (vendorData as any).id,
        username: (vendorData as any).username,
        name: (vendorData as any).name || (vendorData as any).firm_name || (vendorData as any).username,
        role: "worker",
        organisationId: (vendorData as any).organisation_id,
        organisationPlan: "free",
      };
    }
  } catch (err: any) {
    throw err;
  }

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
    const { data: adminData, error: adminErr } = await supabase
      .from("org_admins")
      .select("id, username, name, organisation_id, phone, subscription_tier")
      .ilike("phone", `%${digits10}%`)
      .limit(1)
      .maybeSingle();

    if (adminErr) {
      console.error("DB Error (org_admins phone search):", adminErr);
      throw new Error(`Database error: ${adminErr.message}`);
    }

    if (adminData) {
      if (!adminData.organisation_id) {
        throw new Error("Account not linked to any organisation.");
      }
      return {
        id: adminData.id,
        username: (adminData as any).username,
        name: (adminData as any).name || (adminData as any).username,
        role: "admin",
        organisationId: adminData.organisation_id,
        organisationPlan: ((adminData as any).subscription_tier as any) ?? "free",
        phone,
        isNewUser: false,
      };
    }
  } catch (err: any) {
    throw err;
  }

  // Check workers
  try {
    const { data: workerData, error: workerErr } = await supabase
      .from("workers")
      .select("id, username, name, role, organisation_id, phone")
      .ilike("phone", `%${digits10}%`)
      .limit(1)
      .maybeSingle();

    if (workerErr) {
      console.error("DB Error (workers phone search):", workerErr);
      throw new Error(`Database error: ${workerErr.message}`);
    }

    if (workerData) {
      if (!workerData.organisation_id) {
        throw new Error("Account not linked to any organisation.");
      }
      return {
        id: workerData.id,
        username: (workerData as any).username,
        name: (workerData as any).name || (workerData as any).username,
        role: ((workerData as any).role as "admin" | "worker") || "worker",
        organisationId: workerData.organisation_id,
        organisationPlan: "free",
        phone,
        isNewUser: false,
      };
    }
  } catch (err: any) {
    throw err;
  }

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
  const { data: newOrg, error: orgError } = await supabase
    .from("organisations")
    .insert({
      name: payload?.orgName || `${digits10}'s Business`,
      status: "approved",
      access_enabled: true,
    })
    .select("id")
    .single();

  if (orgError || !newOrg) {
    console.error("Failed to create organisation:", orgError);
    throw new Error(`Organisation creation failed: ${orgError?.message || 'Unknown error'}`);
  }
  
  const organisationId = (newOrg as any).id;

  // Create the org_admin linked to the new org
  const { data: created, error: adminError } = await supabase
    .from("org_admins")
    .insert({
      username: payload?.email || digits10,
      name: payload?.orgName || digits10,
      phone: digits10,
      password: payload?.password || digits10,
      organisation_id: organisationId,
    })
    .select("id, username, name, organisation_id")
    .single();

  if (adminError || !created) {
    console.error(`Orphaned org (ID: ${organisationId}). Admin creation failed.`, adminError);
    throw new Error(`Admin creation failed: ${adminError?.message || 'Unknown error'}`);
  }

  // Seed settings with phone number so it pre-fills
  const { error: settingsError } = await supabase.from("settings").insert({
    organisation_id: organisationId,
    business_name: payload?.brandName || payload?.orgName || "",
    address: payload?.address || "",
    gst_number: payload?.gst || "",
    email: payload?.email || "",
    phone: digits10,
    whatsapp: digits10,
  });

  if (settingsError) {
    console.error(`Failed to seed settings for org ${organisationId}:`, settingsError);
    throw new Error(`Settings initialization failed: ${settingsError.message}`);
  }

  return {
    id: (created as any).id,
    username: (created as any).username,
    name: (created as any).name,
    role: "admin",
    organisationId: (created as any).organisation_id,
    organisationPlan: payload?.plan || "free",
    phone,
    isNewUser: true,
  };
}

// Keep for backward compatibility
export async function loginWithPhone(phone: string): Promise<AuthUser> {
  return registerUserByPhone(phone);
}

// end of authService.ts
