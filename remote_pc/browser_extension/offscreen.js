// Offscreen canvas frame capturer for Chrome/Firefox Extension
const video = document.getElementById("streamVideo");
const canvas = document.getElementById("streamCanvas");
const ctx = canvas.getContext("2d");

async function startCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      setInterval(() => {
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
