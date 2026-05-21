import { Redis } from "@upstash/redis";

export interface TaskState {
  status: "pending" | "processing" | "done" | "partial" | "failed";
  progress: { current: number; total: number };
  perPageStatus: Array<{ page_index: number; status: string }>;
  result?: Record<string, unknown>;
  failedPages?: Array<{ page_index: number; error: string; retry_allowed: boolean }>;
  estimatedRemaining?: number;
}

const TASK_TTL = 1800; // 30 minutes

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis !== null) return _redis;
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) {
    _redis = false as unknown as null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// In-memory fallback for dev
const memStore = new Map<string, { data: TaskState; expiresAt: number }>();

function key(id: string) {
  return `task:${id}`;
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

  const redis = getRedis();
  if (redis) {
    await redis.set(key(id), task, { ex: TASK_TTL });
  } else {
    memStore.set(id, { data: task, expiresAt: Date.now() + TASK_TTL * 1000 });
  }

  return task;
}

export async function getTask(
  id: string
): Promise<TaskState | undefined> {
  const redis = getRedis();
  if (redis) {
    const data = await redis.get<TaskState>(key(id));
    return data ?? undefined;
  }

  const entry = memStore.get(id);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(id);
    return undefined;
  }
  return entry.data;
}

export async function updateTask(
  id: string,
  updates: Partial<TaskState>
): Promise<void> {
  const existing = await getTask(id);
  if (!existing) return;

  const merged = { ...existing, ...updates };

  const redis = getRedis();
  if (redis) {
    await redis.set(key(id), merged, { ex: TASK_TTL });
  } else {
    memStore.set(id, { data: merged, expiresAt: Date.now() + TASK_TTL * 1000 });
  }
}

export async function deleteTask(id: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key(id));
  } else {
    memStore.delete(id);
  }
}
