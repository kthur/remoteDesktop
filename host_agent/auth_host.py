import os
import json
import hashlib

class HostAuth:
    """Manages Google User pairing and Device Identity for Host PC Agent"""
    def __init__(self, config_path=None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "host_config.json")
        self.config_path = config_path
        self.config_path = config_path
        self.google_email = None
        self.google_user_id = None
        self.device_id = None
        self.load_config()

    def load_config(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.google_email = data.get("google_email")
                    self.google_user_id = data.get("google_user_id")
                    self.device_id = data.get("device_id")
            except Exception as e:
                print(f"Error loading config: {e}")

        if not self.device_id:
            import socket
            import uuid
            hostname = socket.gethostname()
            mac_addr = str(uuid.getnode())
            self.device_id = f"pc_{hashlib.md5((hostname + mac_addr).encode()).hexdigest()[:16]}"
            self.save_config()

    def save_config(self):
        data = {
            "google_email": self.google_email,
            "google_user_id": self.google_user_id,
            "device_id": self.device_id
        }
        temp_path = self.config_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(temp_path, self.config_path)

    def set_google_user(self, email, user_id):
        self.google_email = email
        self.google_user_id = user_id
        self.save_config()
