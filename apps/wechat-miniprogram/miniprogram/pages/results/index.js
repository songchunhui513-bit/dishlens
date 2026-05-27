/* global Page, wx */
const config = require("../../utils/config");
const api = require("../../utils/api");
const share = require("../../utils/share");

function dishTitle(dish) {
  const translated = dish.name_translated || {};
  return translated.zh || translated.en || dish.name_original || "一道菜";
}

function dishDescription(dish) {
  const description = dish.description || {};
  return description.zh || description.en || "";
}

function formatDishes(result) {
  return (result.pages || []).reduce((all, page) => {
    const dishes = (page.dishes || []).map((dish) => Object.assign({}, dish, {
      displayName: dishTitle(dish),
      displayDescription: dishDescription(dish),
      pageLabel: page.page_label || "菜单"
    }));
    return all.concat(dishes);
  }, []);
}

Page({
  data: {
    taskId: "",
    result: null,
    dishes: [],
    h5Url: ""
  },

  async onLoad(options) {
    const taskId = options.taskId || "";
    this.setData({ taskId });
    await this.loadResult(taskId);
  },

  async loadResult(taskId) {
    const cached = api.readResult();
    const result = cached && (!taskId || cached.task_id === taskId) ? cached : await api.fetchTaskResult(taskId);
    this.setData({
      result,
      dishes: formatDishes(result),
      h5Url: share.buildH5ShareUrl(result.task_id || taskId)
    });
  },

  openDish(event) {
    const index = Number(event.currentTarget.dataset.index);
    const dish = this.data.dishes[index];
    wx.setStorageSync(config.STORAGE_KEYS.selectedDish, dish);
    wx.navigateTo({ url: `/pages/detail/index?index=${index}` });
  },

  openSharePage() {
    const taskId = this.data.result ? this.data.result.task_id : this.data.taskId;
    wx.navigateTo({ url: `/pages/share-menu/index?taskId=${encodeURIComponent(taskId || "preview-task")}` });
  },

  copyH5Link() {
    wx.setClipboardData({
      data: this.data.h5Url,
      success: () => {
        wx.showModal({
          title: "公开链接已复制",
          content: "可以粘贴到微信群、WhatsApp、Telegram、LINE 或任何浏览器打开。",
          showCancel: false,
          confirmText: "知道了"
        });
      }
    });
  },

  onShareAppMessage() {
    const result = this.data.result || {};
    return {
      title: share.buildShareTitle(result),
      path: share.buildMiniSharePath(result.task_id || this.data.taskId),
      imageUrl: ""
    };
  },

  onShareTimeline() {
    const result = this.data.result || {};
    return {
      title: share.buildShareText(result),
      query: `taskId=${encodeURIComponent(result.task_id || this.data.taskId)}`
    };
  }
});
