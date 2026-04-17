import { supabase } from "./supabaseClient";

export type Task = {
  id: string;
  title: string;
  customer: string;
  description?: string | null;
  worker?: string | null;
  worker_id?: string | null;
  vendor?: string | null;
  vendor_id?: string | null;
  deadline: string | null;
  status: string;
  notes: string | null;
  created_at?: string;
  createdAt?: string;
};

export type Worker = {
  id: string;
  name: string;
  username?: string;
  role?: string;
};

export type Vendor = {
  id: string;
  name: string;
  firm_name?: string | null;
  username?: string;
};

export type TaskIdRecord = {
  id: string;
  type: "worker" | "vendor";
  name: string;
  username: string;
  password: string;
  created_at?: string;
};

export async function getTasks(organisationId?: string): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getTasks:", error.message);
    return [];
  }
  const rows = (data || []) as any[];
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    customer: t.customer,
    description: t.description ?? null,
    worker: t.worker ?? t.worker_id ?? null,
    worker_id: t.worker_id ?? t.worker ?? null,
    vendor: t.vendor ?? t.vendor_id ?? null,
    vendor_id: t.vendor_id ?? t.vendor ?? null,
    deadline: t.deadline ?? null,
    status: t.status ?? "Pending",
    notes: t.notes ?? null,
    created_at: t.created_at,
    createdAt: t.created_at,
  }));
}

export async function addTask(task: {
  id?: string;
  title: string;
  customer: string;
  description?: string | null;
  worker?: string | null;
  vendor?: string | null;
  deadline?: string | null;
  status?: string;
  notes?: string | null;
  organisationId?: string;
}): Promise<Task | null> {
  const id = task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const row: any = {
    id,
    title: task.title,
    customer: task.customer,
    description: task.description ?? null,
    worker_id: task.worker ?? null,
    vendor_id: task.vendor ?? null,
    deadline: task.deadline ?? null,
    status: task.status ?? "Pending",
    notes: task.notes ?? null,
  };
  if (task.organisationId) row.organisation_id = task.organisationId;

  const { data, error } = await supabase
    .from("tasks")
    .insert([row])
    .select("*")
    .single();

  if (error) {
    console.error("[tasks] addTask:", error.message);
    return null;
  }
  return {
    ...data,
    worker: data.worker ?? data.worker_id ?? task.worker,
    vendor: data.vendor ?? data.vendor_id ?? task.vendor,
    createdAt: data.created_at,
  } as Task;
}

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) console.error("[tasks] updateTaskStatus:", error.message);
}

export async function updateTask(
  id: string,
  updates: {
    title?: string;
    customer?: string;
    description?: string | null;
    worker?: string | null;
    vendor?: string | null;
    deadline?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.customer !== undefined) payload.customer = updates.customer;
  if (updates.description !== undefined) payload.description = updates.description ?? null;
  if (updates.worker !== undefined) payload.worker_id = updates.worker ?? null;
  if (updates.vendor !== undefined) payload.vendor_id = updates.vendor ?? null;
  if (updates.deadline !== undefined) payload.deadline = updates.deadline ?? null;
  if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) console.error("[tasks] updateTask:", error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) console.error("[tasks] deleteTask:", error.message);
}

export async function getWorkers(organisationId?: string): Promise<Worker[]> {
  let query = supabase.from("workers").select("id, name, username, role");
  if (organisationId) query = query.eq("organisation_id", organisationId);
  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getWorkers:", error.message);
    return [];
  }
  return (data || []) as Worker[];
}

export async function getVendors(organisationId?: string): Promise<Vendor[]> {
  let query = supabase
    .from("vendors")
    .select("id, name, firm_name, username")
    .order("created_at", { ascending: false });
  if (organisationId) query = query.eq("organisation_id", organisationId);
  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getVendors:", error.message);
    return [];
  }
  const rows = (data || []) as any[];
  return rows.map((v) => ({
    id: v.id,
    name: v.name || v.firm_name || v.username || "",
    firm_name: v.firm_name ?? null,
    username: v.username ?? null,
  }));
}

export async function addTaskId(record: {
  type: "worker" | "vendor";
  name: string;
  username: string;
  password: string;
  organisationId?: string;
}): Promise<TaskIdRecord | null> {
  const row: any = {
    type: record.type,
    name: record.name,
    username: record.username,
    password: record.password,
  };
  if (record.organisationId) row.organisation_id = record.organisationId;

  const { data, error } = await supabase
    .from("task_ids")
    .insert([row])
    .select("*")
    .single();

  if (error) {
    console.error("[tasks] addTaskId:", error.message);
    return null;
  }

  return data as TaskIdRecord;
}

export async function getTaskIds(organisationId?: string): Promise<TaskIdRecord[]> {
  let query = supabase.from("task_ids").select("*").order("created_at", {
    ascending: false,
  });
  if (organisationId) query = query.eq("organisation_id", organisationId);
  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getTaskIds:", error.message);
    return [];
  }
  return (data || []) as TaskIdRecord[];
}
