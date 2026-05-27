# WeChat Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated native WeChat mini program shell for DishLens that reuses the existing backend task/result model and preserves the current H5 deployment.

**Architecture:** Add the mini program under `apps/wechat-miniprogram`, keep H5 pages unchanged, and add a small server-side WeChat session endpoint in Next.js. Mini program sharing uses a native page path while public H5 sharing remains the global fallback.

**Tech Stack:** Native WeChat Mini Program, Next.js App Router API routes, Supabase task store, Node crypto HMAC token signing.

---

## File Structure

- Create `docs/miniprogram/wechat-miniprogram-prd.md`: product requirements, login/share decisions, success metrics.
- Create `docs/miniprogram/wechat-miniprogram-technical-design.md`: architecture, flows, env, testing and rollout.
- Create `apps/wechat-miniprogram/project.config.json`: WeChat DevTools project config.
- Create `apps/wechat-miniprogram/miniprogram/app.json`: mini program page registration.
- Create `apps/wechat-miniprogram/miniprogram/app.js`: app launch and silent login trigger.
- Create `apps/wechat-miniprogram/miniprogram/app.wxss`: global visual system matching DishLens.
- Create `apps/wechat-miniprogram/miniprogram/utils/*.js`: config, request, auth, API, sharing and mock data.
- Create `apps/wechat-miniprogram/miniprogram/pages/*`: home, camera, loading, results, detail, share-menu, profile.
- Create `src/lib/wechat/session.ts`: sign and verify custom WeChat session tokens.
- Create `src/app/api/v1/wechat/session/route.ts`: exchange `wx.login` code for a DishLens session token.
- Modify `package.json`: add `miniprogram:check`.
- Create `scripts/check-miniprogram.mjs`: validate mini program file structure and JSON.

### Task 1: Product And Technical Docs

**Files:**
- Create: `docs/miniprogram/wechat-miniprogram-prd.md`
- Create: `docs/miniprogram/wechat-miniprogram-technical-design.md`

- [x] **Step 1: Document the login decision**

Write that DishLens uses silent login first, then asks for avatar/nickname only when profile, saved history, favorite sync, or visible sharing identity needs it.

- [x] **Step 2: Document the share decision**

Write that mini program card sharing is primary inside WeChat, while `https://dishlens.wukongmkt.com/share/{taskId}` remains the global fallback link for non-WeChat and overseas users.

- [x] **Step 3: Capture M1/M2 scope**

M1 creates the isolated shell and single-image end-to-end path. M2 completes multi-image mini program upload, persistent profile/favorites/history, and production AppID rollout.

### Task 2: Mini Program Shell

**Files:**
- Create: `apps/wechat-miniprogram/project.config.json`
- Create: `apps/wechat-miniprogram/miniprogram/app.json`
- Create: `apps/wechat-miniprogram/miniprogram/app.js`
- Create: `apps/wechat-miniprogram/miniprogram/app.wxss`
- Create: `apps/wechat-miniprogram/miniprogram/sitemap.json`

- [x] **Step 1: Create WeChat DevTools config**

Use `touristappid` until the new official AppID is available.

- [x] **Step 2: Register pages**

Register home, camera, loading, results, detail, share-menu and profile pages in `app.json`.

- [x] **Step 3: Add global visual tokens**

Match the current H5 warm cream/green/orange illustration style without importing H5 CSS.

### Task 3: Mini Program Utilities

**Files:**
- Create: `apps/wechat-miniprogram/miniprogram/utils/config.js`
- Create: `apps/wechat-miniprogram/miniprogram/utils/request.js`
- Create: `apps/wechat-miniprogram/miniprogram/utils/auth.js`
- Create: `apps/wechat-miniprogram/miniprogram/utils/api.js`
- Create: `apps/wechat-miniprogram/miniprogram/utils/share.js`
- Create: `apps/wechat-miniprogram/miniprogram/utils/mock-data.js`

- [x] **Step 1: Add API config**

Set `API_BASE_URL` to `https://dishlens.wukongmkt.com` and build all URLs from it.

- [x] **Step 2: Add request wrapper**

Wrap `wx.request` and attach `Authorization: Bearer {token}` when present.

- [x] **Step 3: Add auth helper**

Call `wx.login`, post code to `/api/v1/wechat/session`, persist token and user data in storage.

- [x] **Step 4: Add task API helper**

Upload one menu photo for M1, poll `/api/v1/task/{taskId}`, and use mock data when no task exists in local preview.

### Task 4: Mini Program Pages

**Files:**
- Create: `apps/wechat-miniprogram/miniprogram/pages/home/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/camera/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/loading/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/results/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/detail/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/share-menu/index.*`
- Create: `apps/wechat-miniprogram/miniprogram/pages/profile/index.*`

- [x] **Step 1: Build home page**

Create brand header, primary scan entry, share/history/favorite/profile shortcuts.

- [x] **Step 2: Build capture page**

Use `wx.chooseMedia` for camera/album selection and pass chosen file paths to loading page.

- [x] **Step 3: Build loading page**

Upload the selected photo, poll task progress, then navigate to results.

- [x] **Step 4: Build result/detail pages**

Render the same DishLens dish fields used by H5: translated name, original name, description, ingredients, recommendation and caution.

- [x] **Step 5: Build share/profile pages**

Use `onShareAppMessage`, `onShareTimeline`, copy H5 link, and profile avatar/nickname fill controls.

### Task 5: WeChat Session Endpoint

**Files:**
- Create: `src/lib/wechat/session.ts`
- Create: `src/app/api/v1/wechat/session/route.ts`

- [x] **Step 1: Add HMAC session helper**

Create base64url helpers, deterministic public user id hashing, `signWechatSession`, and `verifyWechatSessionToken`.

- [x] **Step 2: Add login route**

Validate `code`, call WeChat `jscode2session`, never return `session_key`, and return a DishLens session token.

- [x] **Step 3: Handle missing env**

Return HTTP 503 when `WECHAT_MINIPROGRAM_APPID`, `WECHAT_MINIPROGRAM_SECRET`, or `WECHAT_SESSION_JWT_SECRET` is missing.

### Task 6: Verification And Commit

**Files:**
- Modify: `package.json`
- Create: `scripts/check-miniprogram.mjs`

- [x] **Step 1: Add local structure check**

Validate JSON files and ensure every page in `app.json` has `.js`, `.json`, `.wxml`, `.wxss`.

- [x] **Step 2: Run checks**

Run:

```bash
npm run miniprogram:check
npm run lint
npm run build
```

- [x] **Step 3: Commit isolated work**

Commit only mini program, docs, WeChat session endpoint, package script and check script. Do not add unrelated untracked prototype files.
