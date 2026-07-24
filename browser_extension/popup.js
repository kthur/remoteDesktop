document.addEventListener("DOMContentLoaded", () => {
  const btnToggle = document.getElementById("btnToggle");
  const txtStatus = document.getElementById("txtStatus");
  const statusDot = document.getElementById("statusDot");
  let isRunning = false;

  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (response) {
      if (response.isConnected) {
        setRunningState(true);
      }
      const txtAccount = document.getElementById("txtAccount");
      if (txtAccount) {
        txtAccount.textContent = response.email || "Not Logged In";
      }
    }
  });

  btnToggle.addEventListener("click", () => {
    if (!isRunning) {
      chrome.runtime.sendMessage({ type: "START_HOST" }, () => {
        setRunningState(true);
      });
    } else {
      chrome.runtime.sendMessage({ type: "STOP_HOST" }, () => {
        setRunningState(false);
      });
    }
  });

  function setRunningState(running) {
    isRunning = running;
    if (running) {
      statusDot.classList.add("online");
      txtStatus.textContent = "Browser Host Running (Online)";
      btnToggle.textContent = "⏹️ Stop Browser Host";
      btnToggle.classList.add("btn-stop");
    } else {
      statusDot.classList.remove("online");
      txtStatus.textContent = "Host Agent Stopped";
      btnToggle.textContent = "🚀 Start Browser Host";
      btnToggle.classList.remove("btn-stop");
    }
  }
});
