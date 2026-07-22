# AnyRemote PC - Cross-Platform Remote Control System

A complete Remote PC Screen & Window Control system for Windows and Linux hosts, controlled via Flutter Mobile App (Android & iOS) with Google Sign-In device discovery.

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

5. **Cross-Platform Mobile App (Android & iOS)**:
   - Built with **Flutter** for smooth 60fps canvas rendering, responsive touch gestures, and single codebase targeting both Android and iOS.

---

## 📁 Repository Structure

```
d:\project\remote_pc/
├── server/               # Node.js Express & WebSocket Signaling / Auth Server
│   ├── index.js
│   └── package.json
├── host_agent/           # Python Windows/Linux PC Host Daemon
│   ├── main.py
│   ├── screen_capturer.py
│   ├── display_manager.py
│   ├── input_handler.py
│   ├── auth_host.py
│   └── requirements.txt
└── mobile_app/           # Flutter Mobile App (Android & iOS)
    ├── pubspec.yaml
    └── lib/
        ├── main.dart
        ├── services/
        │   ├── auth_service.dart
        │   └── remote_service.dart
        └── screens/
            ├── login_screen.dart
            ├── device_list_screen.dart
            └── remote_control_screen.dart
```

---

## 🚀 How to Run

### 1. Start Signaling & Auth Server
```bash
cd server
npm install
npm start
```
*Server runs at `ws://localhost:8080` (HTTP port 8080)*

### 2. Start PC Host Agent (Windows / Linux)
```bash
cd host_agent
pip install -r requirements.txt
python main.py
```
*Host agent will automatically register active windows, current resolution, and connect to the signaling server.*

### 3. Run Flutter Mobile App (Android / iOS)
```bash
cd mobile_app
flutter pub get
flutter run
```

---

## 🛠️ Verification & Diagnostic Script

You can verify the Host Agent screen capturer, display manager, and window enumeration locally by running:
```bash
python -c "from host_agent.screen_capturer import ScreenCapturer; sc = ScreenCapturer(); print(sc.list_windows())"
```
