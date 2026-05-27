/* global Page, wx */
const auth = require("../../utils/auth");
const config = require("../../utils/config");
const { mockResult } = require("../../utils/mock-data");

Page({
  data: {
    user: null
  },

  onShow() {
    const session = auth.readSession();
    this.setData({ user: session ? session.user : null });
  },

  goCamera() {
    wx.navigateTo({ url: "/pages/camera/index" });
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/index" });
  },

  openPreview() {
    wx.setStorageSync(config.STORAGE_KEYS.result, mockResult);
    wx.navigateTo({ url: "/pages/results/index?taskId=preview-task" });
  }
});
