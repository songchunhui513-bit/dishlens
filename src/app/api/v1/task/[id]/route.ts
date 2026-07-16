import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/cache/task-store";
import { sanitizeTranslationResultImages } from "@/lib/server/sanitize-translation-result";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    task_id: id,
    type: "translate",
    status: task.status,
    progress: task.progress,
    per_page_status: task.perPageStatus,
    result: sanitizeTranslationResultImages(task.result),
    failed_pages: task.failedPages,
    estimated_remaining_seconds: task.estimatedRemaining,
  });
}
