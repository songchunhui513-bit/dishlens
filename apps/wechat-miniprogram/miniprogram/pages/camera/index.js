/* global Page, wx */
const config = require("../../utils/config");

Page({
  data: {
    filePaths: []
  },

  chooseFromCamera() {
    this.chooseMedia(["camera"]);
  },

  chooseFromAlbum() {
    this.chooseMedia(["album"]);
  },

  chooseMedia(sourceType) {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType,
      sizeType: ["compressed"],
      success: (res) => {
        const filePaths = (res.tempFiles || []).map((file) => file.tempFilePath).filter(Boolean);
        this.setData({ filePaths });
        wx.setStorageSync(config.STORAGE_KEYS.pendingPhotos, filePaths);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes("cancel")) return;
        wx.showToast({ title: "无法选择图片", icon: "none" });
      }
    });
  },

  startTranslate() {
    if (!this.data.filePaths.length) {
      wx.showToast({ title: "先选择菜单照片", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/loading/index" });
  }
});
