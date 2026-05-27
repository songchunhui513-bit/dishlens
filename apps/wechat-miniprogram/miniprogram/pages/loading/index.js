/* global Page, wx */
const config = require("../../utils/config");
const api = require("../../utils/api");

Page({
  data: {
    current: 0,
    total: 1,
    statusText: "正在准备菜单照片",
    taskId: ""
  },

  onLoad() {
    this.start();
  },

  async start() {
    const filePaths = wx.getStorageSync(config.STORAGE_KEYS.pendingPhotos) || [];
    if (!filePaths.length) {
      wx.showModal({
        title: "还没有菜单照片",
        content: "请先拍摄或选择一张菜单。",
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }

    try {
      this.setData({ statusText: "正在上传菜单照片" });
      const created = await api.createTranslationTask(filePaths);
      const taskId = created.task_id;
      this.setData({ taskId, statusText: "正在识别菜名和描述" });

      const result = await api.waitForTask(taskId, (task) => {
        this.setData({
          current: task.progress ? task.progress.current : 0,
          total: task.progress ? task.progress.total : 1,
          statusText: task.status === "processing" ? "正在翻译菜单" : "正在整理结果"
        });
      });

      wx.redirectTo({
        url: `/pages/results/index?taskId=${encodeURIComponent(result.task_id || taskId)}`
      });
    } catch (error) {
      wx.showModal({
        title: "翻译没有完成",
        content: error.message || "请稍后重新尝试。",
        confirmText: "回去重拍",
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }
  }
});
