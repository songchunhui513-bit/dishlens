export type LoadingResultClassification = "displayable" | "empty";
export type LoadingTaskAction = "complete" | "timeout" | "continue";

export function classifyLoadingResult(result: unknown): LoadingResultClassification {
  if (!result || typeof result !== "object") return "empty";
  const pages = (result as { pages?: unknown }).pages;
  if (!Array.isArray(pages) || pages.length === 0) return "empty";

  const hasMenuDishes = pages.some((page) => {
    if (!page || typeof page !== "object") return false;
    const dishes = (page as { dishes?: unknown }).dishes;
    return Array.isArray(dishes) && dishes.length > 0;
  });
  if (hasMenuDishes) return "displayable";

  const hasInformationPage = pages.some((page) => {
    if (!page || typeof page !== "object") return false;
    const candidate = page as { page_type?: unknown; page_label?: unknown };
    return candidate.page_type === "info" || candidate.page_label === "说明页";
  });
  return hasInformationPage ? "displayable" : "empty";
}

export function resolveLoadingTaskAction(status: string | undefined, result: unknown): LoadingTaskAction {
  if (classifyLoadingResult(result) === "displayable") return "complete";
  if (status === "done" || status === "partial" || status === "failed") return "timeout";
  return "continue";
}

