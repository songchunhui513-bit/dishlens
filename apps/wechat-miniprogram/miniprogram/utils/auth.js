/* global wx */
const config = require("./config");
const { request } = require("./request");

function readSession() {
  return wx.getStorageSync(config.STORAGE_KEYS.session) || null;
}

function saveSession(session) {
  wx.setStorageSync(config.STORAGE_KEYS.session, session);
  return session;
}

function loginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code);
          return;
        }
        reject(new Error(res.errMsg || "wx.login failed"));
      },
      fail(err) {
        reject(new Error(err.errMsg || "wx.login failed"));
      }
    });
  });
}

async function silentLogin() {
  const cached = readSession();
  if (cached && cached.expiresAt && cached.expiresAt > Date.now() + 60000) {
    return cached;
  }

  const code = await loginCode();
  const data = await request({
    url: "/api/v1/wechat/session",
    method: "POST",
    header: { "Content-Type": "application/json" },
    data: { code }
  });

  return saveSession({
    token: data.token,
    user: data.user,
    expiresAt: Date.now() + (data.expires_in || 0) * 1000
  });
}

function saveProfileDraft(profile) {
  const current = wx.getStorageSync(config.STORAGE_KEYS.profileDraft) || {};
  const next = Object.assign({}, current, profile);
  wx.setStorageSync(config.STORAGE_KEYS.profileDraft, next);
  return next;
}

module.exports = {
  readSession,
  saveProfileDraft,
  silentLogin
};
