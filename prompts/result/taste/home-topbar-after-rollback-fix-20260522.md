# Home Topbar After Rollback Fix

**Date:** 2026-05-22  
**Objective:** Restore the App.vue global topbar on the Home page after user rolled back previous commits.
**Status:** Complete

---

## 1. Objective
Restore the `App.vue` global topbar on the Home page (`/`) with minimal CSS-only changes, keeping `App.vue` as the sole global topbar owner without adding any local cockpit topbars or moving layouts to `index.html`.

---

## 2. Current Repo State Inspected
1. `frontend/src/App.vue` renders the global topbar (`<header class="app-header">` with ZTE brand mark, "AI WORKER PLATFORM", "PR Creator", and dashboard/job history/admin links).
2. `frontend/src/styles.css` originally hid the global topbar when the Home page cockpit was active:
   ```css
   .app-shell:has(.home-cockpit) .app-header {
     display: none;
   }
   ```
3. The Home page originally used the full-viewport layout assumption:
   ```css
   .app-shell:has(.home-cockpit) .page-main {
     height: 100dvh;
     margin: 0;
     max-width: none;
     overflow: hidden;
     padding: 0;
   }
   .home-cockpit {
     height: 100dvh;
   }
   ```

---

## 3. Root Cause
The global `App.vue` topbar existed and was rendered, but Home-specific CSS explicitly hid it via `display: none` on `.app-header`. Additionally, the Home cockpit and page-main layouts were hardcoded to `100dvh` height, consuming the full viewport height and leaving no room for the topbar.

---

## 4. Files Changed
* `frontend/src/styles.css`
* `prompts/result/taste/home-topbar-after-rollback-fix-20260522.md` (this file)

---

## 5. Exact CSS/Layout Fix Implemented
1. **Removed the CSS rule** hiding `.app-header` when `.home-cockpit` is active:
   ```css
   /* Removed:
   .app-shell:has(.home-cockpit) .app-header {
     display: none;
   }
   */
   ```
2. **Updated the App Shell layout** on Home page to use flexbox direction column and fit within `100dvh`:
   ```css
   .app-shell:has(.home-cockpit) {
     background: linear-gradient(180deg, #eef7ff 0%, #f8fbff 42%, #ffffff 100%);
     height: 100dvh;
     overflow: hidden;
     display: flex;
     flex-direction: column;
   }
   ```
3. **Adjusted `.page-main` and `.home-cockpit`** to fit below the topbar:
   ```css
   .app-shell:has(.home-cockpit) .page-main {
     flex: 1;
     min-height: 0;
     overflow: hidden;
     padding: 10px 0 0;
   }

   .home-cockpit {
     --zte-blue: #0072ce;
     --zte-blue-strong: #005aa3;
     --zte-blue-soft: #e6f4ff;
     --zte-line: #c8e1f7;
     color: #12304a;
     display: flex;
     flex-direction: column;
     gap: 10px;
     height: 100%;
     min-height: 0;
     overflow: hidden;
     padding: 0 14px 14px;
     max-width: 1080px;
     margin: 0 auto;
   }
   ```

---

## 6. Confirmations & Constraints
* **App.vue remains global topbar owner:** Yes, `App.vue` renders the topbar global header, which is shared across all pages.
* **Home has exactly one topbar:** Yes, the single `App.vue` global topbar. No local cockpit topbar was added back to `HomeView.vue`.
* **Backend unchanged:** Yes, no backend or database code was touched.
* **API/routes unchanged:** Yes, no API contracts, router definitions, or WebSocket files were modified.
* **Worker Console scrolls internally:** Yes, console scrolling is fully preserved under `overflow-y: auto`.

---

## 7. Build/Test Results
* **Build Command:** `npm run build` inside `frontend` completed successfully.
* **Test Command:** `npm run test` inside `frontend` (which runs `vite build && node scripts/route-smoke.js`) passed successfully with:
  ```json
  {"ok":true,"routes":["/","/history","/jobs/QA15-ROUTE-SMOKE","/admin/login","/admin/assets","/admin/audit-logs","/admin/health"]}
  ```

---

## 8. Manual Visual Checks
* **`/` shows the App.vue global topbar:** Verified.
* **`/` has no duplicate topbar:** Verified.
* **Home content appears below the topbar:** Verified.
* **Upload & Validate, Job Scope, Sites, Download cards are visible:** Verified.
* **AI Chatbox is visible:** Verified.
* **Worker Console is visible and internally scrollable:** Verified.
* **`/admin/health` is unchanged:** Verified.
* **`/admin/assets` is unchanged:** Verified.
* **`/history` is unchanged:** Verified.
* **Text `PR Worker Console` does not appear in the visible global topbar:** Verified.

---

## 9. Known Limitations
None. The fix is a minimal, clean, CSS-only alignment solution.

---

## 10. Git Information
* **Branch:** `main`
* **Commit Hash (base):** `915ac41688a6ef5c4aa1f6389b6c7eb692dc77ac`
* **Push Status:** Pushed / Up to date with origin/main.
