import sys
import os
import threading
import asyncio
import tkinter as tk
from tkinter import ttk, messagebox

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from main import run_host_agent
from auth_host import HostAuth


class AnyRemoteHostGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("AnyRemote PC Host Agent")
        self.root.geometry("460x600")
        self.root.resizable(False, False)
        self.root.configure(bg="#0F172A")

        self.auth = HostAuth()
        self.is_running = False
        self.host_thread = None
        self.loop = None
        self._qr_photo = None  # Keep reference to prevent GC

        self._setup_ui()

    def _setup_ui(self):
        # ── Header ─────────────────────────────────────────────
        header = tk.Frame(self.root, bg="#1E293B", height=60)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(
            header,
            text="🖥️ AnyRemote PC Host",
            font=("Segoe UI", 15, "bold"),
            fg="#38BDF8",
            bg="#1E293B"
        ).pack(side="left", padx=20, pady=12)

        tk.Label(
            header,
            text="v1.1",
            font=("Segoe UI", 9),
            fg="#94A3B8",
            bg="#1E293B"
        ).pack(side="right", padx=20)

        # ── Content ─────────────────────────────────────────────
        content = tk.Frame(self.root, bg="#0F172A", padx=20, pady=14)
        content.pack(fill="both", expand=True)

        # Account Info
        auth_box = tk.LabelFrame(
            content,
            text=" Account ",
            font=("Segoe UI", 9, "bold"),
            fg="#94A3B8",
            bg="#0F172A",
            padx=12, pady=8
        )
        auth_box.pack(fill="x", pady=(0, 8))

        user_email = self.auth.google_email or "Not Logged In (Guest Mode)"
        tk.Label(
            auth_box,
            text=f"📧  {user_email}",
            font=("Segoe UI", 10, "bold"),
            fg="#F8FAFC", bg="#0F172A", anchor="w"
        ).pack(fill="x")

        tk.Label(
            auth_box,
            text=f"🔑  Device ID: {self.auth.device_id}",
            font=("Segoe UI", 8),
            fg="#64748B", bg="#0F172A", anchor="w"
        ).pack(fill="x", pady=(3, 0))

        # Status Bar
        status_bar = tk.Frame(content, bg="#1E293B", padx=14, pady=10)
        status_bar.pack(fill="x", pady=(0, 8))

        self.lbl_status_icon = tk.Label(
            status_bar, text="🔴",
            font=("Segoe UI", 13), bg="#1E293B"
        )
        self.lbl_status_icon.pack(side="left")

        self.lbl_status_text = tk.Label(
            status_bar,
            text="Host Agent Stopped",
            font=("Segoe UI", 10, "bold"),
            fg="#F8FAFC", bg="#1E293B"
        )
        self.lbl_status_text.pack(side="left", padx=8)

        # Start/Stop Button
        self.btn_toggle = tk.Button(
            content,
            text="🚀  Start Host Agent",
            font=("Segoe UI", 12, "bold"),
            fg="#FFFFFF", bg="#0284C7",
            activebackground="#0369A1",
            activeforeground="#FFFFFF",
            relief="flat", pady=10,
            command=self.toggle_agent
        )
        self.btn_toggle.pack(fill="x", pady=(0, 10))

        # ── QR Code Panel ───────────────────────────────────────
        qr_frame = tk.LabelFrame(
            content,
            text=" 📲  QR Code — 모바일로 스캔하여 연결 ",
            font=("Segoe UI", 9, "bold"),
            fg="#38BDF8",
            bg="#0F172A",
            padx=10, pady=10
        )
        qr_frame.pack(fill="both", expand=True, pady=(0, 6))

        self.lbl_qr_hint = tk.Label(
            qr_frame,
            text="Host Agent를 시작하면\nQR 코드가 여기에 표시됩니다",
            font=("Segoe UI", 10),
            fg="#64748B", bg="#0F172A",
            justify="center"
        )
        self.lbl_qr_hint.pack(expand=True)

        self.lbl_qr_image = tk.Label(qr_frame, bg="#0F172A")
        # Hidden until QR is ready

        self.lbl_qr_url = tk.Label(
            qr_frame,
            text="",
            font=("Segoe UI", 7),
            fg="#94A3B8", bg="#0F172A",
            wraplength=400, justify="center"
        )
        self.lbl_qr_url.pack()

        # Footer
        tk.Label(
            content,
            text="Windows 10/11 | No installation needed",
            font=("Segoe UI", 7),
            fg="#334155", bg="#0F172A"
        ).pack(side="bottom")

    # ── Agent Control ───────────────────────────────────────────
    def toggle_agent(self):
        if not self.is_running:
            self.start_agent()
        else:
            self.stop_agent()

    def start_agent(self):
        self.is_running = True
        self.lbl_status_icon.config(text="🟡")
        self.lbl_status_text.config(text="Starting… (tunnel 연결 중)", fg="#FCD34D")
        self.btn_toggle.config(
            text="⏹️  Stop Host Agent",
            bg="#DC2626", activebackground="#B91C1C"
        )
        # Reset QR panel to loading state
        self.lbl_qr_hint.config(text="터널 연결 중… QR 생성에 최대 15초 소요됩니다")
        self.lbl_qr_image.pack_forget()
        self.lbl_qr_hint.pack(expand=True)

        def _run_loop():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            try:
                self.loop.run_until_complete(
                    run_host_agent(on_qr_ready=self._on_qr_ready)
                )
            except Exception as e:
                print(f"Host loop stopped: {e}")
            finally:
                # Reset UI when loop ends
                self.root.after(0, self._on_agent_stopped)

        self.host_thread = threading.Thread(target=_run_loop, daemon=True)
        self.host_thread.start()

    def stop_agent(self):
        self.is_running = False
        if self.loop:
            self.loop.call_soon_threadsafe(self.loop.stop)

    def _on_agent_stopped(self):
        """Called on the main thread when the agent loop ends."""
        self.is_running = False
        self.lbl_status_icon.config(text="🔴")
        self.lbl_status_text.config(text="Host Agent Stopped", fg="#F8FAFC")
        self.btn_toggle.config(
            text="🚀  Start Host Agent",
            bg="#0284C7", activebackground="#0369A1"
        )

    # ── QR Display (thread-safe via root.after) ─────────────────
    def _on_qr_ready(self, image_path: str):
        """Called from background thread when QR PNG is generated."""
        self.root.after(0, lambda: self._show_qr(image_path))

    def _show_qr(self, image_path: str):
        """Update the QR panel on the main thread."""
        # Update status to Online
        self.lbl_status_icon.config(text="🟢")
        self.lbl_status_text.config(text="Host Agent Running (Online)", fg="#4ADE80")

        if PIL_AVAILABLE and os.path.exists(image_path):
            try:
                img = Image.open(image_path)
                # Scale to fit nicely (max 220x220)
                img = img.resize((220, 220), Image.NEAREST)
                photo = ImageTk.PhotoImage(img)
                self._qr_photo = photo  # prevent GC

                self.lbl_qr_hint.pack_forget()
                self.lbl_qr_image.config(image=photo, bg="#FFFFFF", padx=6, pady=6)
                self.lbl_qr_image.pack(pady=(4, 2))

                # Show URL below QR
                self.lbl_qr_url.config(text=f"📁 {image_path}")
            except Exception as e:
                self.lbl_qr_hint.config(
                    text=f"QR 이미지 로드 실패:\n{e}\n\n파일 위치:\n{image_path}",
                    fg="#F87171"
                )
        else:
            msg = (
                f"QR 코드가 생성되었습니다.\n파일을 열어 스캔하세요:\n\n{image_path}"
                if os.path.exists(image_path)
                else "Pillow 패키지 필요: pip install pillow"
            )
            self.lbl_qr_hint.config(text=msg, fg="#FCD34D")


def main_gui():
    root = tk.Tk()
    app = AnyRemoteHostGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main_gui()
