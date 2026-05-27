const config = require("./config");

function buildMiniSharePath(taskId) {
  return `/pages/share-menu/index?taskId=${encodeURIComponent(taskId || "")}`;
}

function buildH5ShareUrl(taskId) {
  return `${config.H5_SHARE_BASE_URL}/${encodeURIComponent(taskId || "")}`;
}

function firstDishes(result) {
  const pages = result && result.pages ? result.pages : [];
  return pages
    .reduce((all, page) => all.concat(page.dishes || []), [])
    .slice(0, 3)
    .map((dish) => {
      const translated = dish.name_translated || {};
      return translated.zh || translated.en || dish.name_original;
    })
    .filter(Boolean);
}

function buildShareTitle(result) {
  const count = result && result.metadata ? result.metadata.total_dishes : 0;
  return `DishLens 分享菜单 · ${count || "多"} 道菜`;
}

function buildShareText(result) {
  const names = firstDishes(result);
  if (!names.length) return "朋友分享了一份菜单，点开一起看菜。";
  return `朋友分享了一份菜单：${names.join("、")}。点开一起看菜。`;
}

module.exports = {
  buildH5ShareUrl,
  buildMiniSharePath,
  buildShareText,
  buildShareTitle
};
