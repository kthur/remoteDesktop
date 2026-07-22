---
name: actioncheck
description: Check the status of ALL jobs across every GitHub Actions workflow run (PC Host, Android APK, iOS Bundle, WebExtension, and Release), extract failure logs for any failing job, diagnose root causes, and automatically apply fixes to workflow YAML files or project code.
---

# ActionCheck - Multi-Job GitHub Actions Diagnostic & Auto-Fix Skill

This skill inspects and verifies **ALL jobs** within GitHub Actions workflows for the repository, ensuring complete coverage across PC, Android, iOS, WebExtension, and Release deployment pipelines.

## Multi-Job Workflow Execution Protocol

### Step 1: Query Workflow Runs & Enumerate ALL Jobs
Execute GitHub CLI or API to inspect all jobs within the latest run:
```bash
# Get run ID and enumerate every single job
gh run view --json jobs
```
Inspect and tabulate the status of **ALL Jobs**:

| Job Name | Target Component | Status | Log Inspection |
|---|---|---|---|
| 💻 **`build-pc-host`** | Windows Standalone Executable (`AnyRemote_Host.exe`) | `success` / `failure` | Inspect Python/PyInstaller log |
| 📱 **`build-mobile-android`** | Android Release APK (`app-release.apk`) | `success` / `failure` | Inspect Flutter/Gradle log |
| 🍎 **`build-mobile-ios`** | iOS App Bundle (`AnyRemote_iOS_Runner.zip`) | `success` / `failure` | Inspect Flutter/Xcode log |
| 🌐 **`package-extension`** | WebExtension (`AnyRemote_Browser_Extension.zip`) | `success` / `failure` | Inspect zip packaging log |
| 🚀 **`release`** | GitHub Release Asset Upload | `success` / `failure` | Inspect release upload log |

---

### Step 2: Extract Logs for EVERY Failing Job
For **every job** where `status != "success"`, retrieve job-specific error logs:
```bash
# Fetch failed logs for specific job
gh run view <RUN_ID> --job <JOB_ID> --log-failed
```
If GitHub CLI is unavailable, query jobs via API:
```bash
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/{owner}/{repo}/actions/runs/{RUN_ID}/jobs"
```
Read the un-truncated logs for each failing job to extract:
1. **Failing Job Name & Step Index**
2. **Exact Exception Traceback / Exit Code**
3. **Missing File Paths or Environment Variables**

---

### Step 3: Comprehensive Multi-Job Diagnosis & Matrix Fix

| Job | Common Error | Automated Remediation |
|---|---|---|
| 💻 **`build-pc-host`** | PyInstaller missing `--add-data` separator or missing Python dep | Update `build_standalone.py` with `os.pathsep` or `requirements.txt` |
| 📱 **`build-mobile-android`** | Gradle JDK version mismatch or APK output path error | Set `java-version: '17'` and fix relative artifact path |
| 🍎 **`build-mobile-ios`** | macOS `Runner.app` compression path error or missing codesign | Add path fallback logic (`Release-iphoneos` vs `iphoneos`) & `--no-codesign` |
| 🌐 **`package-extension`** | Missing Manifest V3 required key or invalid zip path | Validate `manifest.json` schema and extension directory structure |
| 🚀 **`release`** | Unrecognized `secrets` syntax in `if:` expression or 403 token | Map secret to `env:` variable and set `permissions: contents: write` |

---

### Step 4: Apply Fixes & Verify Full Green Build
1. Update `.github/workflows/*.yml` or corresponding source files.
2. Commit and push changes: `git push origin main`.
3. Re-query all jobs (`gh run view --json jobs`) to verify **100% green status across ALL jobs**.
