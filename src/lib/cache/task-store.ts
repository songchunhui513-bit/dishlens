import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TaskState {
  status: "pending" | "processing" | "done" | "partial" | "failed";
  progress: { current: number; total: number };
  perPageStatus: Array<{ page_index: number; status: string }>;
  result?: Record<string, unknown>;
  failedPages?: Array<{ page_index: number; error: string; retry_allowed: boolean }>;
  estimatedRemaining?: number;
}

let _db: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_db) return _db;
  _db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  return _db;
}

export async function createTask(
  id: string,
  total: number
): Promise<TaskState> {
  const task: TaskState = {
    status: "processing",
    progress: { current: 0, total },
    perPageStatus: Array.from({ length: total }, (_, i) => ({
      page_index: i,
      status: "pending",
    })),
  };

  await db().from("tasks").insert({
    id,
    status: task.status,
    progress: task.progress,
    per_page_status: task.perPageStatus,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  return task;
}

export async function getTask(
  id: string
): Promise<TaskState | undefined> {
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;

  return {
    status: data.status,
    progress: data.progress,
    perPageStatus: data.per_page_status,
    result: data.result,
    failedPages: data.failed_pages,
    estimatedRemaining: data.estimated_remaining,
  };
}

export async function updateTask(
  id: string,
  updates: Partial<TaskState>
): Promise<void> {
  const existing = await getTask(id);
  if (!existing) return;

  const merged = { ...existing, ...updates };

  const row: Record<string, unknown> = {
    status: merged.status,
    progress: merged.progress,
    per_page_status: merged.perPageStatus,
  };
  if (merged.result) row.result = merged.result;
  if (merged.failedPages) row.failed_pages = merged.failedPages;
  if (merged.estimatedRemaining !== undefined) row.estimated_remaining = merged.estimatedRemaining;

  await db().from("tasks").update(row).eq("id", id);
}

export async function deleteTask(id: string): Promise<void> {
  await db().from("tasks").delete().eq("id", id);
}
