import { createClient } from "@supabase/supabase-js";

// NOTE: For the Android app we hard-code the same public Supabase URL and anon key
// that are already exposed in the web .env. This avoids config issues in Expo Go.
const SUPABASE_URL = "https://vajskkpzezplpxyvsuym.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhanNra3B6ZXpwbHB4eXZzdXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzE1MjksImV4cCI6MjA4NzYwNzUyOX0.WYnhQD7aY4_6MRX41ci4LdS_diKEy1NO6jD1kaujM9I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Bill = {
  id: string;
  customer: string;
  total: number;
  createdAt: string;
  paid?: boolean;
};

export type Task = {
  id: string;
  title: string;
  customer?: string | null;
  worker?: string | null;
  vendor?: string | null;
  deadline?: string | null;
  status: "Pending" | "In Progress" | "Completed";
};

export type Customer = {
  id: string;
  name: string;
};

