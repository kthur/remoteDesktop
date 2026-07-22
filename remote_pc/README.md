# AnyRemote PC - Cross-Platform Remote Control System

A complete Remote PC Screen & Window Control system for Windows and Linux hosts, controlled via Flutter Mobile App (Android & iOS) or Chrome/Firefox Extension with Google Sign-In device discovery.

---

## 🌟 Key Features

1. **Google Account Device Sharing**:
   - Both Host PC and Mobile App authenticate with Google Login.
   - Host PCs are automatically registered and discovered under the user's Google ID.

2. **Windows Manager Menu (Window Selection)**:
   - Mobile App features a **Windows Manager Menu** showing all open application windows on the PC (Chrome, VS Code, Notepad, etc.).
   - Users can choose to view/control **Full Desktop** or focus on a **Specific Application Window**.

3. **Display Resolution Adjustment & Fitting**:
   - Change Windows PC monitor resolution directly from the Mobile App menu.
   - **Fit to Mobile Resolution** feature automatically matches PC resolution/aspect ratio to your mobile screen.

4. **Background Connection & Low-Data Mode**:
   - Automatically detects when Mobile App is sent to background/minimized.
   - Pauses heavy video frame encoding and switches to a low-bandwidth heartbeat (~1 KB/s) to save mobile data.
   - Instantly resumes high FPS streaming when returned to foreground without reconnecting.

5. **1-Click Standalone PC Executable (`AnyRemote_Host.exe`)**:
   - Zero-dependency desktop application. No `npm`, `node`, or `python` command line setup required for PC users.

6. **Chrome & Firefox Extension Host Agent (`browser_extension/`)**:
   - WebExtension Manifest V3 capturing screens, windows, or browser tabs directly from your web browser.

7. **🤖 GitHub Actions Automated CI/CD Release**:
   - Automated workflows build PC Host App, Android APK, iOS App, and Extension zip files automatically on Git tag push (`v*`) and publish them directly to **GitHub Releases**.

---

## 📁 Repository Structure

```
d:\project\remote_pc/
├── .github/workflows/
│   └── build_and_release.yml  # Automated GitHub Actions CI/CD Build & Release
├── build_standalone.py        # Automated script to build AnyRemote_Host.exe
├── host_agent/                # Standalone Desktop PC Host Agent
│   ├── gui_launcher.py        # 1-Click GUI launcher
│   ├── main.py
│   ├── screen_capturer.py
│   ├── display_manager.py
│   ├── input_handler.py
│   └── auth_host.py
├── browser_extension/         # Chrome & Firefox Extension Host Agent
│   ├── manifest.json
│   ├── background.js
│   ├── offscreen.html / .js
│   └── popup.html / .js
├── server/                    # Node.js Express & WebSocket Signaling Server
│   ├── index.js
│   └── package.json
└── mobile_app/                # Flutter Mobile App (Android & iOS)
    ├── pubspec.yaml
    └── lib/
```

---

## 🚀 GitHub Actions Release Trigger

To automatically trigger the build pipeline and publish binaries to GitHub Releases:
```bash
git tag v1.0.0
git push origin v1.0.0
```
This automatically compiles and attaches:
- `AnyRemote_PC_Host_Windows.zip` (PC Host Standalone `.exe`)
- `app-release.apk` (Android Mobile App)
- `AnyRemote_iOS_Runner.zip` (iOS Mobile App)
- `AnyRemote_Browser_Extension.zip` (Chrome & Firefox Extension)
to your repository's GitHub Releases page!
