type MenuAnalysisLike = {
  dishes?: unknown[];
  page_label?: string;
  page_type?: string;
};

const INFO_PAGE_LABELS = ["说明页", "信息页", "品牌页", "故事页", "非菜单页"];
const INFO_PAGE_TYPES = ["info", "story", "brand", "non_menu", "non-menu"];

export function isInformationMenuPage(result: MenuAnalysisLike): boolean {
  const label = (result.page_label || "").trim().toLowerCase();
  const type = (result.page_type || "").trim().toLowerCase();

  return (
    INFO_PAGE_LABELS.some((item) => label.includes(item.toLowerCase())) ||
    INFO_PAGE_TYPES.some((item) => type === item)
  );
}

export function shouldRetryEmptyMenuResult(
  result: MenuAnalysisLike,
  attempt: number,
  maxRetries: number,
): boolean {
  const dishCount = Array.isArray(result.dishes) ? result.dishes.length : 0;
  if (dishCount > 0) return false;
  if (isInformationMenuPage(result)) return false;
  return attempt < maxRetries - 1;
}
