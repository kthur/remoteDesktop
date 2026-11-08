// Offscreen canvas frame capturer for Chrome/Firefox Extension
const video = document.getElementById("streamVideo");
const canvas = document.getElementById("streamCanvas");
const ctx = canvas.getContext("2d");

let mediaStream = null;
let captureInterval = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STOP_CAPTURE') {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
  }
});

async function startCapture() {
  try {
    // Use streamId from desktopCapture if available, else fall back to getDisplayMedia
    let streamId = null;
    try {
      const result = await chrome.storage.session.get('captureStreamId');
      streamId = result.captureStreamId || null;
    } catch (e) {}

    if (streamId) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId
          }
        }
      });
    } else {
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
    }
    video.srcObject = mediaStream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      captureInterval = setInterval(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Jpeg = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];

          chrome.runtime.sendMessage({
            type: "OFFSCREEN_FRAME",
            frame: base64Jpeg
          });
        }
      }, 50); // 20 FPS stream
    };
  } catch (err) {
    console.error("getDisplayMedia error:", err);
  }
}

// Auto start stream if needed
startCapture();
