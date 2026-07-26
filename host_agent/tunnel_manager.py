import subprocess
import threading
import re
import time
import sys
import os

class TunnelManager:
    """Manages asynchronous Cloudflare Tunnel creation for LTE/5G external network access."""
    def __init__(self, port=8080):
        self.port = port
        self.public_url = None
        self.wss_url = None
        self.process = None
        self.stop_event = threading.Event()
        self._url_ready_event = threading.Event()

    def wait_for_url(self, timeout=30):
        self._url_ready_event.wait(timeout=timeout)
        return self.wss_url

    def start_tunnel(self):
        """Spawns cloudflared tunnel via npx in a background thread and extracts the trycloudflare WSS URL."""
        def run():
            try:
                import shutil
                cloudflared_path = shutil.which('cloudflared')
                if sys.platform == "win32":
                    if cloudflared_path:
                        full_cmd = f"cmd.exe /c \"{cloudflared_path}\" tunnel --url http://localhost:{self.port}"
                    else:
                        full_cmd = f"cmd.exe /c npx -y cloudflared tunnel --url http://localhost:{self.port}"
                    self.process = subprocess.Popen(
                        full_cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True
                    )
                else:
                    if cloudflared_path:
                        cmd = [cloudflared_path, "tunnel", "--url", f"http://localhost:{self.port}"]
                    else:
                        cmd = ["npx", "-y", "cloudflared", "tunnel", "--url", f"http://localhost:{self.port}"]
                    self.process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True
                    )

                url_pattern = re.compile(r'https://[a-zA-Z0-9][a-zA-Z0-9-]*\.trycloudflare\.com')
                for line in iter(self.process.stdout.readline, ''):
                    if self.stop_event.is_set():
                        break
                    line_str = line.strip()
                    if "trycloudflare.com" in line_str:
                        match = url_pattern.search(line_str)
                        if match and not self.wss_url:
                            self.public_url = match.group(0)
                            self.wss_url = self.public_url.replace("https://", "wss://")
                            self._url_ready_event.set()
                            print(f"\n==================================================")
                            print(f" 🌐 [PUBLIC TUNNEL ONLINE] LTE/5G External Access URL:")
                            print(f"    HTTPS: {self.public_url}")
                            print(f"    WSS  : {self.wss_url}")
                            print(f"==================================================\n")
                
                if not self.stop_event.is_set():
                    print(" [TUNNEL WARNING] cloudflared process exited unexpectedly.")
                    self.wss_url = None
                    self._url_ready_event.clear()
            except Exception as e:
                print(f" [TUNNEL ERROR] Could not start cloudflared tunnel: {e}")
                self.wss_url = None
                self._url_ready_event.clear()

        thread = threading.Thread(target=run, daemon=True)
        thread.start()

    def get_wss_url(self):
        return self.wss_url

    def stop(self):
        self.stop_event.set()
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            except Exception:
                pass
