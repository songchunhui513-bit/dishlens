/* global Page, wx */
const auth = require("../../utils/auth");

Page({
  data: {
    session: null,
    avatarUrl: "",
    nickname: "",
    statusText: "正在检查微信登录状态"
  },

  onLoad() {
    this.refreshSession();
  },

  async refreshSession() {
    try {
      const session = await auth.silentLogin();
      this.setData({
        session,
        statusText: session && session.token ? "已完成静默登录" : "未登录"
      });
    } catch (error) {
      this.setData({ statusText: "静默登录暂不可用，可稍后重试" });
    }
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    this.setData({ avatarUrl });
    auth.saveProfileDraft({ avatarUrl });
  },

  onNicknameInput(event) {
    const nickname = event.detail.value;
    this.setData({ nickname });
    auth.saveProfileDraft({ nickname });
  }
});
