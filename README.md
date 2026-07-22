# 🖥️ AnyRemote PC — Cross-Platform Remote Control System

[![GitHub Actions CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?style=flat-square&logo=github-actions)](.github/workflows/build_and_release.yml)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20Android%20%7C%20iOS%20%7C%20Chrome%20%7C%20Firefox-brightgreen?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](#)

A high-performance, low-latency Remote PC Screen & Window Control system connecting Windows and Linux hosts with Android and iOS Mobile Apps (or Web Extensions) via Google Sign-In device discovery.

---

## 🌟 Key Features

### 🔐 1. Google Account Device Discovery & Sharing
- **1-Click Sync**: Authenticate with Google Sign-In on both Host PC and Mobile App.
- **Auto Discovery**: Host PCs and Browser Extensions registered under your Google ID are automatically discovered without typing IP addresses or complex routing.

### 🪟 2. Windows Manager Menu (Application Window Selection)
- **Select Specific Windows**: Mobile App features a **Windows Manager Menu** listing all active PC application windows (Chrome, VS Code, Notepad, File Explorer, etc.).
- **Desktop vs Window View**: Switch between **Full Desktop View** and **Single Application Window View** on the fly.

### ⚙️ 3. Windows Resolution Adjustment & Mobile Screen Fitting
- **Remote Resolution Control**: Change PC monitor resolution directly from the Mobile App.
- **Fit to Mobile Resolution**: Automatically matches PC resolution & aspect ratio to your mobile screen dimensions.

### 🔋 4. Background Low-Data Mode Persistence (Data Saver)
- **Auto Data Saver**: Automatically detects when Mobile App is sent to background or minimized.
- **Low-Bandwidth Heartbeat**: Pauses heavy video frame encoding and maintains connection with a ~1 KB/s heartbeat ping.
- **Instant Resume**: Restoring Mobile App instantly resumes high FPS video streaming without reconnecting.

### 📦 5. Zero-Dependency Standalone PC Executable (`AnyRemote_Host.exe`)
- **No Command Line / npm Needed**: Single `.exe` desktop app bundled via PyInstaller.
- **1-Click GUI Launcher**: Double-click `AnyRemote_Host.exe` to run the host daemon with a system tray interface.

### 🌐 6. Chrome & Firefox WebExtension Host Agent
- **WebExtension Manifest V3**: Compatible with Chrome, Firefox, Edge, and Brave.
- **`getDisplayMedia` / `chrome.desktopCapture`**: Capture screens, windows, or tabs directly from any browser without software installation.

### 🤖 7. Automated GitHub Actions CI/CD Release
- **Automated Builds**: Pushing a tag (`v*`) triggers GitHub Actions to compile all targets:
  - 💻 `AnyRemote_PC_Host_Windows.zip` (`AnyRemote_Host.exe`)
  - 📱 `app-release.apk` (Android Mobile App)
  - 🍎 `AnyRemote_iOS_Runner.zip` (iOS Mobile App)
  - 🌐 `AnyRemote_Browser_Extension.zip` (Chrome & Firefox Extension)

---

## 📁 Repository Structure

```
d:\project\remote_pc/
├── .github/workflows/
│   └── build_and_release.yml  # GitHub Actions CI/CD Build & Release Workflow
├── build_standalone.py        # 1-Click PyInstaller compilation script
├── host_agent/                # Desktop Host Agent (Python + Tkinter GUI)
│   ├── gui_launcher.py        # 1-Click Desktop GUI Launcher
│   ├── main.py                # Host daemon logic
│   ├── screen_capturer.py     # Windows & Desktop capture engine
│   ├── display_manager.py    # Windows resolution switcher
│   ├── input_handler.py      # OS mouse/keyboard input simulator
│   └── auth_host.py          # Google Auth ID manager
├── browser_extension/         # Chrome & Firefox Extension Host Agent
│   ├── manifest.json          # WebExtension Manifest V3
│   ├── background.js          # Extension Service Worker
│   ├── offscreen.html / .js   # getDisplayMedia frame stream encoder
│   └── popup.html / .js       # Extension Popup UI
├── server/                    # Node.js Express & WebSocket Signaling Server
│   ├── index.js
│   └── package.json
└── mobile_app/                # Flutter Mobile App (Android & iOS)
    ├── pubspec.yaml
    └── lib/
        ├── main.dart
        ├── services/
        └── screens/
```

---

## 🚀 Quick Start Guide

### Option 1: Run 1-Click Standalone Desktop Executable (`.exe`)
Build the single `.exe` file once:
```bash
python build_standalone.py
```
Double-click `dist\AnyRemote_Host\AnyRemote_Host.exe` to run the Desktop Host Agent!

### Option 2: Load Chrome & Firefox WebExtension Host
1. Open **Chrome** and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select `d:\project\remote_pc\browser_extension`.
4. Click **🚀 Start Browser Host** in the extension popup.

### Option 3: Run Flutter Mobile App (Android & iOS)
```bash
cd mobile_app
flutter pub get
flutter run
```

---

## 🏷️ GitHub Actions CI/CD Automated Release

To automatically trigger a release build and upload artifacts to **GitHub Releases**:
```bash
git tag -a v1.0.0 -m "Release AnyRemote v1.0.0"
git push origin v1.0.0 --force
```

---

## 📄 License
Licensed under the [MIT License](LICENSE).
