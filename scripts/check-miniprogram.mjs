import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const projectRoot = path.join(root, "apps/wechat-miniprogram");
const miniprogramRoot = path.join(projectRoot, "miniprogram");

const requiredFiles = [
  "project.config.json",
  "miniprogram/app.json",
  "miniprogram/app.js",
  "miniprogram/app.wxss",
  "miniprogram/sitemap.json",
  "miniprogram/utils/config.js",
  "miniprogram/utils/request.js",
  "miniprogram/utils/auth.js",
  "miniprogram/utils/api.js",
  "miniprogram/utils/share.js",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing ${relativePath}`);
  }
}

for (const file of requiredFiles) {
  assertFile(file);
}

const projectConfig = readJson(path.join(projectRoot, "project.config.json"));
if (!projectConfig.appid) {
  throw new Error("project.config.json must include appid");
}

const appJson = readJson(path.join(miniprogramRoot, "app.json"));
if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
  throw new Error("app.json must define pages");
}

for (const page of appJson.pages) {
  for (const ext of ["js", "json", "wxml", "wxss"]) {
    const filePath = path.join(miniprogramRoot, `${page}.${ext}`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing page file ${page}.${ext}`);
    }
  }
}

console.log(`Mini program check passed: ${appJson.pages.length} pages, appid=${projectConfig.appid}`);
