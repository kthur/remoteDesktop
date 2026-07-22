import sys
import os
import threading
import asyncio
import tkinter as tk
from tkinter import ttk, messagebox
from main import run_host_agent
from auth_host import HostAuth

class AnyRemoteHostGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("AnyRemote PC Host Agent")
        self.root.geometry("450x380")
        self.root.resizable(False, False)
        self.root.configure(bg="#0F172A")

        self.auth = HostAuth()
        self.is_running = False
        self.host_thread = None
        self.loop = None

        self._setup_ui()

    def _setup_ui(self):
        # Header Banner
        header = tk.Frame(self.root, bg="#1E293B", height=70)
        header.pack(fill="x")

        lbl_title = tk.Label(
            header,
            text="🖥️ AnyRemote PC Host",
            font=("Segoe UI", 16, "bold"),
            fg="#38BDF8",
            bg="#1E293B"
        )
        lbl_title.pack(side="left", padx=20, pady=15)

        lbl_sub = tk.Label(
            header,
            text="v1.0 Standalone",
            font=("Segoe UI", 9),
            fg="#94A3B8",
            bg="#1E293B"
        )
        lbl_sub.pack(side="right", padx=20, pady=20)

        # Content Card
        content = tk.Frame(self.root, bg="#0F172A", padx=25, pady=20)
        content.pack(fill="both", expand=True)

        # Google Auth Info Box
        auth_box = tk.LabelFrame(
            content,
            text=" Synced Google Account ",
            font=("Segoe UI", 10, "bold"),
            fg="#94A3B8",
            bg="#0F172A",
            padx=15,
            pady=10
        )
        auth_box.pack(fill="x", pady=5)

        user_email = self.auth.google_email or "demo.user@gmail.com"
        self.lbl_email = tk.Label(
            auth_box,
            text=f"📧 {user_email}",
            font=("Segoe UI", 11, "bold"),
            fg="#F8FAFC",
            bg="#0F172A"
        )
        self.lbl_email.pack(anchor="w")

        self.lbl_device = tk.Label(
            auth_box,
            text=f"🔑 Device ID: {self.auth.device_id}",
            font=("Segoe UI", 9),
            fg="#64748B",
            bg="#0F172A"
        )
        self.lbl_device.pack(anchor="w", pady=(4, 0))

        # Status Indicator Box
        status_box = tk.Frame(content, bg="#1E293B", padx=15, pady=12)
        status_box.pack(fill="x", pady=15)

        self.lbl_status_icon = tk.Label(
            status_box,
            text="🔴",
            font=("Segoe UI", 14),
            bg="#1E293B"
        )
        self.lbl_status_icon.pack(side="left")

        self.lbl_status_text = tk.Label(
            status_box,
            text="Host Agent Stopped",
            font=("Segoe UI", 11, "bold"),
            fg="#F8FAFC",
            bg="#1E293B"
        )
        self.lbl_status_text.pack(side="left", padx=10)

        # Control Buttons
        btn_frame = tk.Frame(content, bg="#0F172A")
        btn_frame.pack(fill="x", pady=10)

        self.btn_toggle = tk.Button(
            btn_frame,
            text="🚀 Start Host Agent",
            font=("Segoe UI", 12, "bold"),
            fg="#FFFFFF",
            bg="#0284C7",
            activebackground="#0369A1",
            activeforeground="#FFFFFF",
            relief="flat",
            pady=10,
            command=self.toggle_agent
        )
        self.btn_toggle.pack(fill="x")

        lbl_footer = tk.Label(
            content,
            text="Supports Windows 10/11 & Linux | No installation needed",
            font=("Segoe UI", 8),
            fg="#64748B",
            bg="#0F172A"
        )
        lbl_footer.pack(side="bottom", pady=5)

    def toggle_agent(self):
        if not self.is_running:
            self.start_agent()
        else:
            self.stop_agent()

    def start_agent(self):
        self.is_running = True
        self.lbl_status_icon.config(text="🟢")
        self.lbl_status_text.config(text="Host Agent Running (Online)", fg="#4ADE80")
        self.btn_toggle.config(text="⏹️ Stop Host Agent", bg="#DC2626", activebackground="#B91C1C")

        def _run_loop():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            try:
                self.loop.run_until_complete(run_host_agent())
            except Exception as e:
                print(f"Host loop stopped: {e}")

        self.host_thread = threading.Thread(target=_run_loop, daemon=True)
        self.host_thread.start()

    def stop_agent(self):
        self.is_running = False
        if self.loop:
            self.loop.call_soon_threadsafe(self.loop.stop)
        self.lbl_status_icon.config(text="🔴")
        self.lbl_status_text.config(text="Host Agent Stopped", fg="#F8FAFC")
        self.btn_toggle.config(text="🚀 Start Host Agent", bg="#0284C7", activebackground="#0369A1")

def main_gui():
    root = tk.Tk()
    app = AnyRemoteHostGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main_gui()
