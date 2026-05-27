const config = require("./config");
const { request, uploadMenuPhoto } = require("./request");
const { mockResult } = require("./mock-data");

function saveResult(result) {
  wx.setStorageSync(config.STORAGE_KEYS.result, result);
  return result;
}

function readResult() {
  return wx.getStorageSync(config.STORAGE_KEYS.result) || null;
}

async function createTranslationTask(filePaths) {
  if (!filePaths || !filePaths.length) {
    throw new Error("请选择菜单照片");
  }

  if (filePaths.length > 1) {
    wx.showToast({
      title: "首版先处理 1 张",
      icon: "none"
    });
  }

  return uploadMenuPhoto(filePaths[0], "zh");
}

async function pollTask(taskId) {
  return request({
    url: `/api/v1/task/${encodeURIComponent(taskId)}`
  });
}

async function waitForTask(taskId, onProgress) {
  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await pollTask(taskId);
    if (onProgress) onProgress(task);

    if ((task.status === "done" || task.status === "partial") && task.result) {
      return saveResult(task.result);
    }

    if (task.status === "failed") {
      throw new Error("菜单识别失败，请重新拍摄");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("识别时间较长，请稍后重试");
}

async function fetchTaskResult(taskId) {
  if (!taskId || taskId === "preview-task") {
    return saveResult(mockResult);
  }

  const task = await pollTask(taskId);
  if (task && task.result) {
    return saveResult(task.result);
  }

  return saveResult(mockResult);
}

module.exports = {
  createTranslationTask,
  fetchTaskResult,
  readResult,
  saveResult,
  waitForTask
};
