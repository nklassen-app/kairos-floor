# The Floor — Native Wrapper

**Stage:** Floor escapes Chrome
**Repo:** `nklassen-app/kairos-floor`
**Approach:** Capacitor shell over the existing hosted page. No rewrite.
**Date:** July 2026

---

## 1. Definition of done

The Floor opens from its own launcher icon while Brick has Chrome blocked, logs sessions, and survives app restarts with data intact. Content updates still ship through the existing loop — push to the repo, the app picks them up on next open — with no APK rebuild. W29 backfill is present in the new app's storage. That is the whole bar. Anything beyond it (native features, notifications, widgets, Play Store) is out of scope.

## 2. Why this shape

- **PWA install is ruled out.** An Android WebAPK delegates to the Chrome process; Brick blocking Chrome kills it. Same for TWA/Bubblewrap. The dependency to cut is the Chrome *process*.
- **Capacitor + Android System WebView** is the smallest thing that works: WebView is a separate system component unaffected by Brick, and it supports localStorage and service workers, so `index.html` runs unchanged.
- **Remote `server.url`, not bundled assets.** The shell points at the hosted page instead of packaging HTML into the APK. This preserves the deploy loop and means the APK is built approximately once, ever. The service worker gives offline capability after first load.
- **Debug build, sideloaded.** Personal single-device use needs no release signing, no keystore management, no store. A debug APK installs fine with "unknown sources" enabled. Rebuilding later re-uses the auto-generated debug keystore.

## 3. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Wrapper | Capacitor (Android only) | Mainstream, minimal, HTML untouched |
| Content source | `server.url` → hosted page | Keep push-to-deploy; no APK rebuilds for content |
| Signing | Debug keystore | Sideload only; frugality |
| Storage | WebView's own localStorage | Isolated from Chrome's — requires one-time W29 backfill (§6) |
| Data migration tooling | None | One manual backfill beats building an export/import path for three integers |

**Assumption to confirm before starting:** the page is hosted at a stable HTTPS URL (GitHub Pages for this repo, presumably `https://nklassen-app.github.io/kairos-floor/`). Capacitor's `server.url` requires HTTPS. If Pages isn't enabled yet, enabling it is step U1.

## 4. Claude Code implements

One story, unweighted steps:

**N1 — Capacitor shell**
☐ `npm init` + Capacitor scaffold in a new `native/` directory (or sibling repo — keep the web page's root clean so Pages still serves it)
☐ `capacitor.config` with `appId`, `appName: "The Floor"`, `server.url` set to the hosted page, `server.allowNavigation` scoped to that host only
☐ App icon from the existing `icon.svg` (rasterized to the required densities)
☐ Gradle debug build producing `app-debug.apk`
☐ Build scripted so it's reproducible from a clean clone (one command)

Claude Code can also drive the SDK install (step U2) via command-line tools if you prefer terminal over Android Studio — say so at the start of the session.

## 5. You do (enabling steps, in order)

**U1 — Confirm hosting.** Verify the page loads at its HTTPS URL in a browser. If not: repo Settings → Pages → deploy from `master`. *Anchor: before the Claude Code session.*

**U2 — Android toolchain, once.** JDK 17 + Android SDK command-line tools in the WSL2/Chromebook container (no Android Studio needed for a CLI build). Accept SDK licenses. This is the boring hour of the project; it's one-time.

**U3 — Phone prep.** Settings → allow installs from unknown sources for whatever app you'll open the APK with (Files, Drive).

**U4 — Install.** Transfer `app-debug.apk` to the phone (Drive is fine), tap to install.

**U5 — First run online.** Open the app once with network so the service worker caches the page. Then verify offline: airplane mode, reopen, it should still load.

**U6 — Backfill W29.** The WebView's localStorage starts empty. Simplest path, using the deploy loop you already have: add a temporary guard to `index.html` —
```js
if(!localStorage.getItem('floor-2026-w29'))
  localStorage.setItem('floor-2026-w29', JSON.stringify({car:5,str:2,yog:2}));
```
— push, open the app once, then delete the line and push again (bump the sw.js cache name both times so the page actually refreshes). Adjust the numbers to what W29 actually was. Alternative if you'd rather not touch the page: enable `webContentsDebuggingEnabled` in the Capacitor config and run the line from desktop Chrome via `chrome://inspect` over USB — more setup, zero code churn.

**U7 — The Brick test.** With Chrome blocked by Brick: open The Floor, log a pip, close, reopen, confirm it stuck. This is the acceptance test for the whole stage.

## 6. Operational notes

- **Two storage universes exist during transition.** Chrome's copy of the data keeps living in Chrome. After U7 passes, treat the native app as the single source of truth and never log in the Chrome version again — split records across the two would be silently wrong in the coverage grid.
- **The sw.js cache-bump discipline still applies.** Content changes need `floor-vN` incremented or the app serves the stale page, same as before.
- **APK rebuilds are needed only for shell changes** (icon, app name, config) — expected frequency: never.

## 7. Out of scope

Play Store distribution; release signing; iOS; push notifications or reminders (the floor is pull-based by design); any native plugin; data export/sync; widgets. If the build session starts reaching for any of these, that's the safe harbor — stop at the DoD.
