import asyncio
import json
import socket
import sys
import os
import base64
import websockets
from screen_capturer import ScreenCapturer
from display_manager import DisplayManager
from input_handler import InputHandler
from auth_host import HostAuth

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SERVER_URI = os.getenv("SIGNALING_SERVER", "ws://localhost:8080")

async def run_host_agent():
    auth = HostAuth()
    if not auth.google_user_id:
        auth.set_google_user("demo.user@gmail.com", "google_user_12345")

    capturer = ScreenCapturer()
    display_mgr = DisplayManager()
    input_handler = InputHandler()

    hostname = socket.gethostname()
    os_name = f"{sys.platform.capitalize()} ({hostname})"

    print(f"==================================================")
    print(f" 🚀 Remote PC Host Agent Started")
    print(f" Host: {hostname} | OS: {sys.platform}")
    print(f" Registered Google ID: {auth.google_email} ({auth.google_user_id})")
    print(f" Connecting to Signaling Server: {SERVER_URI}")
    print(f"==================================================")

    while True:
        try:
            async with websockets.connect(SERVER_URI) as ws:
                res_info = display_mgr.get_current_resolution()
                windows_list = capturer.list_windows()
                reg_payload = {
                    "type": "register_host",
                    "google_user_id": auth.google_user_id,
                    "google_email": auth.google_email,
                    "device_id": auth.device_id,
                    "device_name": hostname,
                    "os": os_name,
                    "resolution": res_info,
                    "windows": windows_list,
                    "supported_resolutions": display_mgr.list_supported_resolutions()
                }
                await ws.send(json.dumps(reg_payload))
                print(" Registered successfully with signaling server.")

                async def message_listener():
                    try:
                        async for raw_msg in ws:
                            msg = json.loads(raw_msg)
                            msg_type = msg.get("type")

                            if msg_type == "input_event":
                                input_handler.process_command(msg.get("payload", {}), capturer)

                            elif msg_type == "select_window":
                                handle = msg.get("handle")
                                capturer.set_target_window(handle)
                                print(f" Target capture switched to window handle: {handle}")

                            elif msg_type == "change_resolution":
                                w = msg.get("width")
                                h = msg.get("height")
                                success, note = display_mgr.change_resolution(w, h)
                                updated_res = display_mgr.get_current_resolution()
                                await ws.send(json.dumps({
                                    "type": "resolution_updated",
                                    "resolution": updated_res,
                                    "status": note
                                }))

                            elif msg_type == "fit_resolution":
                                mw = msg.get("mobile_width")
                                mh = msg.get("mobile_height")
                                success, note = display_mgr.fit_mobile_resolution(mw, mh)
                                updated_res = display_mgr.get_current_resolution()
                                await ws.send(json.dumps({
                                    "type": "resolution_updated",
                                    "resolution": updated_res,
                                    "status": note
                                }))

                            elif msg_type == "app_state":
                                state = msg.get("state")
                                capturer.is_background = (state == "background")
                                print(f" Mobile App state changed: {state.upper()} (Frame sending paused: {capturer.is_background})")

                            elif msg_type == "request_windows":
                                updated_windows = capturer.list_windows()
                                await ws.send(json.dumps({
                                    "type": "windows_list_update",
                                    "windows": updated_windows
                                }))

                    except Exception as e:
                        print(f"Listener error: {e}")

                listener_task = asyncio.create_task(message_listener())
                frame_count = 0

                while True:
                    if capturer.is_background:
                        await ws.send(json.dumps({"type": "ping", "device_id": auth.device_id}))
                        await asyncio.sleep(2.0)
                    else:
                        frame_bytes = capturer.capture_frame(target_width=1280, quality=65)
                        if frame_bytes:
                            b64_frame = base64.b64encode(frame_bytes).decode('utf-8')
                            frame_packet = {
                                "type": "screen_frame",
                                "device_id": auth.device_id,
                                "frame": b64_frame
                            }
                            await ws.send(json.dumps(frame_packet))
                            frame_count += 1
                            if frame_count % 50 == 0:
                                print(f" 🎬 Streaming active: {frame_count} frames sent ({len(frame_bytes)} bytes/frame)")
                        else:
                            print(" ⚠️ Frame capture returned None. Retrying...")
                        await asyncio.sleep(0.04)

        except (websockets.exceptions.ConnectionClosed, OSError) as err:
            print(f"⚠️ Connection lost: {err}. Reconnecting in 3 seconds...")
            await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(run_host_agent())
    except KeyboardInterrupt:
        print("Host agent stopped.")
