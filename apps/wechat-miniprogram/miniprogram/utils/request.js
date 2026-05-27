/* global wx */
const config = require("./config");

function getSessionToken() {
  const session = wx.getStorageSync(config.STORAGE_KEYS.session);
  return session && session.token ? session.token : "";
}

function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${config.API_BASE_URL}${path}`;
}

function request(options) {
  const token = getSessionToken();
  const header = Object.assign({}, options.header || {});
  if (token) header.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(options.url),
      method: options.method || "GET",
      data: options.data || {},
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && res.data.error) || `HTTP ${res.statusCode}`));
      },
      fail(err) {
        reject(new Error(err.errMsg || "Request failed"));
      }
    });
  });
}

function uploadMenuPhoto(filePath, targetLang) {
  const token = getSessionToken();
  const header = {};
  if (token) header.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: buildUrl("/api/v1/translate/menu"),
      filePath,
      name: "images",
      formData: {
        target_lang: targetLang || "zh"
      },
      header,
      success(res) {
        let data = {};
        try {
          data = JSON.parse(res.data || "{}");
        } catch (error) {
          reject(error);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
          return;
        }
        reject(new Error(data.error || `HTTP ${res.statusCode}`));
      },
      fail(err) {
        reject(new Error(err.errMsg || "Upload failed"));
      }
    });
  });
}

module.exports = {
  request,
  uploadMenuPhoto
};
