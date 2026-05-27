/* global Page, wx */
const api = require("../../utils/api");
const share = require("../../utils/share");

function flattenDishes(result) {
  return (result.pages || []).reduce((all, page) => {
    const dishes = (page.dishes || []).map((dish) => {
      const translated = dish.name_translated || {};
      const description = dish.description || {};
      return Object.assign({}, dish, {
        displayName: translated.zh || translated.en || dish.name_original,
        displayDescription: description.zh || description.en || ""
      });
    });
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
    const taskId = options.taskId || "preview-task";
    this.setData({ taskId });
    const result = await api.fetchTaskResult(taskId);
    this.setData({
      result,
      dishes: flattenDishes(result),
      h5Url: share.buildH5ShareUrl(result.task_id || taskId)
    });
  },

  copyLink() {
    wx.setClipboardData({
      data: this.data.h5Url,
      success: () => {
        wx.showModal({
          title: "链接已复制",
          content: "这条公开链接可以发到微信外的任何聊天工具，对方无需登录即可查看。",
          showCancel: false,
          confirmText: "好的"
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
