import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TaskState } from "./task-store";

type StoredTask = {
  task: TaskState;
  updatedAt: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const STORE_TTL_MS = Math.max(
  60 * 1000,
  Number.parseInt(process.env.MENU_TASK_FILE_STORE_TTL_MS || `${DEFAULT_TTL_MS}`, 10) || DEFAULT_TTL_MS,
);

function storeDir(): string {
  return process.env.MENU_TASK_FILE_STORE_DIR || join(process.cwd(), ".cache", "tasks");
}

function taskPath(id: string): string {
  const filename = crypto.createHash("sha256").update(id).digest("hex");
  return join(storeDir(), `${filename}.json`);
}

export async function getFileTask(id: string, now = Date.now()): Promise<TaskState | undefined> {
  const filePath = taskPath(id);

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredTask;
    if (!parsed?.task || !parsed.updatedAt) return undefined;
    if (now - parsed.updatedAt > STORE_TTL_MS) {
      unlink(filePath).catch(() => {});
      return undefined;
    }
    return parsed.task;
  } catch {
    return undefined;
  }
}

export async function setFileTask(id: string, task: TaskState, now = Date.now()): Promise<void> {
  try {
    await mkdir(storeDir(), { recursive: true });
    await writeFile(taskPath(id), JSON.stringify({ task, updatedAt: now }), "utf8");
  } catch (error) {
    console.warn("Task file store write failed", {
      taskId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteFileTask(id: string): Promise<void> {
  try {
    await unlink(taskPath(id));
  } catch {
    // Missing task files are already deleted from the fallback store.
  }
}
