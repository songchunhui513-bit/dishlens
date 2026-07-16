import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFileTask, getFileTask, setFileTask } from "./task-file-store";

export interface TaskState {
  status: "pending" | "processing" | "done" | "partial" | "failed";
  progress: { current: number; total: number };
  perPageStatus: Array<{ page_index: number; status: string }>;
  result?: Record<string, unknown>;
  failedPages?: Array<{ page_index: number; error: string; retry_allowed: boolean }>;
  estimatedRemaining?: number;
}

interface TaskStoreOptions {
  allowMemoryFallback?: boolean;
  preferMemory?: boolean;
}

type TaskRow = {
  status: TaskState["status"];
  progress: TaskState["progress"];
  per_page_status: TaskState["perPageStatus"];
  result?: Record<string, unknown>;
  failed_pages?: TaskState["failedPages"];
  estimated_remaining?: number;
};

let _db: SupabaseClient | null = null;
const memoryTasks = new Map<string, TaskState>();
const memoryOnlyTasks = new Set<string>();
const ENABLE_MEMORY_FALLBACK = process.env.MENU_TASK_MEMORY_FALLBACK !== "false";

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
  total: number,
  options: TaskStoreOptions = {}
): Promise<TaskState> {
  const task: TaskState = {
    status: "processing",
    progress: { current: 0, total },
    perPageStatus: Array.from({ length: total }, (_, i) => ({
      page_index: i,
      status: "pending",
    })),
  };

  if (options.preferMemory) {
    memoryTasks.set(id, task);
    memoryOnlyTasks.add(id);
    await setFileTask(id, task);
    return task;
  }

  if (options.allowMemoryFallback || ENABLE_MEMORY_FALLBACK) {
    memoryTasks.set(id, task);
    await setFileTask(id, task);
  }

  try {
    const { error } = await db().from("tasks").insert({
      id,
      status: task.status,
      progress: task.progress,
      per_page_status: task.perPageStatus,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    if (error) {
      if (options.allowMemoryFallback || ENABLE_MEMORY_FALLBACK) {
        console.warn("Task store unavailable; using memory fallback", {
          taskId: id,
          error: error.message,
        });
        memoryTasks.set(id, task);
        memoryOnlyTasks.add(id);
        await setFileTask(id, task);
        return task;
      }
      throw new Error(`Task store unavailable: ${error.message}`);
    }
    memoryOnlyTasks.delete(id);
  } catch (error) {
    if (options.allowMemoryFallback || ENABLE_MEMORY_FALLBACK) {
      console.warn("Task store request failed; using memory fallback", {
        taskId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      memoryTasks.set(id, task);
      memoryOnlyTasks.add(id);
      await setFileTask(id, task);
      return task;
    }
    throw error;
  }

  return task;
}

export async function getTask(
  id: string
): Promise<TaskState | undefined> {
  const memoryTask = memoryTasks.get(id);
  if (memoryTask) return memoryTask;

  const fileTask = await getFileTask(id);
  if (fileTask) {
    memoryTasks.set(id, fileTask);
    return fileTask;
  }

  let data: TaskRow | null = null;
  let error: { message?: string } | null = null;
  try {
    const response = await db()
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();
    data = response.data;
    error = response.error;
  } catch (err) {
    console.warn("Task store read failed", {
      taskId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return await getFileTask(id);
  }

  if (error || !data) return await getFileTask(id);

  const task = {
    status: data.status,
    progress: data.progress,
    perPageStatus: data.per_page_status,
    result: data.result,
    failedPages: data.failed_pages,
    estimatedRemaining: data.estimated_remaining,
  };
  memoryTasks.set(id, task);
  await setFileTask(id, task);
  return task;
}

export async function updateTask(
  id: string,
  updates: Partial<TaskState>
): Promise<void> {
  const existing = memoryTasks.get(id) || await getTask(id);
  if (!existing) return;

  const merged: TaskState = {
    status: updates.status || existing.status,
    progress: updates.progress || existing.progress,
    perPageStatus: updates.perPageStatus || existing.perPageStatus,
    result: updates.result || existing.result,
    failedPages: updates.failedPages || existing.failedPages,
    estimatedRemaining: updates.estimatedRemaining ?? existing.estimatedRemaining,
  };

  if (memoryTasks.has(id)) {
    memoryTasks.set(id, merged);
    await setFileTask(id, merged);
    if (memoryOnlyTasks.has(id)) return;
  }

  const row: Record<string, unknown> = {
    status: merged.status,
    progress: merged.progress,
    per_page_status: merged.perPageStatus,
  };
  if (merged.result) row.result = merged.result;
  if (merged.failedPages) row.failed_pages = merged.failedPages;
  if (merged.estimatedRemaining !== undefined) row.estimated_remaining = merged.estimatedRemaining;

  try {
    const { error } = await db().from("tasks").update(row).eq("id", id);
    if (error) {
      console.warn("Task store update failed", {
        taskId: id,
        error: error.message,
      });
      await setFileTask(id, merged);
    }
  } catch (err) {
    console.warn("Task store update request failed", {
      taskId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    await setFileTask(id, merged);
  }
}

export async function deleteTask(id: string): Promise<void> {
  memoryTasks.delete(id);
  memoryOnlyTasks.delete(id);
  await deleteFileTask(id);
  try {
    await db().from("tasks").delete().eq("id", id);
  } catch (err) {
    console.warn("Task store delete request failed", {
      taskId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
