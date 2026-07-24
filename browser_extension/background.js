// AnyRemote PC Host Extension Service Worker (Chrome & Firefox MV3)
let socket = null;
let isConnected = false;
let googleUserId = "";
let googleEmail = "";
let deviceId = "browser_ext_" + Math.random().toString(36).substr(2, 6);

// Handle extension lifecycle and internal offscreen messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_HOST") {
    startHostAgent(message.serverUrl || "ws://localhost:8080");
    sendResponse({ status: "CONNECTING" });
  } else if (message.type === "STOP_HOST") {
    stopHostAgent();
    sendResponse({ status: "STOPPED" });
  } else if (message.type === "GET_STATUS") {
    sendResponse({ isConnected: isConnected, deviceId: deviceId, email: googleEmail });
  } else if (message.type === "OFFSCREEN_FRAME") {
    // Relay frame from offscreen capturer to WebSocket
    if (socket && socket.readyState === WebSocket.OPEN && isConnected) {
      socket.send(JSON.stringify({
        type: "screen_frame",
        device_id: deviceId,
        frame: message.frame
      }));
    }
  }
  return true;
});

function startHostAgent(serverUrl) {
  if (socket) socket.close();

  try {
    socket = new WebSocket(serverUrl);

    socket.onopen = () => {
      isConnected = true;
      console.log("🚀 Extension Host Agent connected to signaling server.");

      const regMsg = {
        type: "register_host",
        google_user_id: googleUserId,
        google_email: googleEmail,
        device_id: deviceId,
        device_name: "Chrome/Firefox Browser Host",
        os: "WebExtension (Browser Host)",
        resolution: { width: 1920, height: 1080 },
        windows: [
          { handle: 0, title: "🖥️ Full Desktop (Browser Stream)", is_desktop: true },
          { handle: 100, title: "🌐 Active Browser Tab Stream", is_desktop: false }
        ]
      };
      socket.send(JSON.stringify(regMsg));
      setupOffscreenDocument();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Extension WS Received:", data.type);

        if (data.type === "input_event") {
          // Dispatch input event to active tab if needed
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: "REMOTE_INPUT", payload: data.payload });
            }
          });
        }
      } catch (e) {
        console.error("Error processing WS message:", e);
      }
    };

    socket.onclose = () => {
      isConnected = false;
      console.log("WS Connection closed.");
    };
  } catch (e) {
    console.error("WS Connect error:", e);
  }
}

function stopHostAgent() {
  if (socket) {
    socket.close();
    socket = null;
  }
  isConnected = false;
}

async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capture screen stream for remote control'
  });
}
