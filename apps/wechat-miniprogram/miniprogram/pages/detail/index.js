/* global Page, wx */
const config = require("../../utils/config");

Page({
  data: {
    dish: null,
    ingredientsText: "",
    allergensText: "",
    tasteText: ""
  },

  onLoad() {
    const dish = wx.getStorageSync(config.STORAGE_KEYS.selectedDish);
    if (!dish) {
      wx.showToast({ title: "没有菜品数据", icon: "none" });
      return;
    }
    this.setData({
      dish,
      ingredientsText: (dish.ingredients || []).join("、") || "暂无",
      allergensText: (dish.allergens || []).join("、") || "暂无明显标注",
      tasteText: (dish.taste_profile || []).join("、") || "暂无"
    });
  }
});
