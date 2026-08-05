import asyncio
import json
import socket
import sys
import os
import io
import base64
import time
import uuid
import websockets

if sys.platform == 'win32':
    try:
        import ctypes
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

if sys.platform == 'win32':
    try:
        if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from screen_capturer import ScreenCapturer
from display_manager import DisplayManager
from input_handler import InputHandler
from auth_host import HostAuth
from tunnel_manager import TunnelManager
from qr_generator import generate_host_qr

SERVER_URI = os.getenv("SIGNALING_SERVER", "ws://localhost:8080")

def get_local_ip_addresses():
    """Retrieve all non-loopback IPv4 addresses of the host machine."""
    ip_list = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and ":" not in ip:
                if ip not in ip_list:
                    ip_list.append(ip)
    except Exception as e:
        print(f"Error fetching hostname IPs: {e}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        active_ip = s.getsockname()[0]
        s.close()
        if active_ip and active_ip not in ip_list and not active_ip.startswith("127."):
            ip_list.append(active_ip)
    except Exception:
        pass

    return ip_list if ip_list else ["127.0.0.1"]

def check_usb_adb_availability(port=8080):
    """Detect if USB ADB port forwarding (127.0.0.1:8080) or USB connection is available."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        result = s.connect_ex(('127.0.0.1', port))
        s.close()
        return result == 0
    except Exception:
        return False

async def start_udp_discovery_service(device_id, device_name, google_user_id, get_net_info_fn):
    """Listen for UDP discovery requests on port 8888 and respond with host details."""
    class UDPDiscoveryProtocol(asyncio.DatagramProtocol):
        def connection_made(self, transport):
            self.transport = transport

        def datagram_received(self, data, addr):
            try:
                message = data.decode('utf-8', errors='ignore')
                if "ANYREMOTE_DISCOVER_REQ" in message:
                    net_info = get_net_info_fn()
                    ws_port = net_info.get("ws_port", 8080)
                    local_ips = net_info.get("local_ips", [])
                    response = json.dumps({
                        "service": "AnyRemote_PC_Host",
                        "status": "ok",
                        "device_id": device_id,
                        "device_name": device_name,
                        "google_user_id": google_user_id,
                        "local_ips": local_ips,
                        "ws_port": ws_port,
                        "usb_available": net_info.get("usb_available", False),
                        "direct_ws_urls": [
                            f"ws://127.0.0.1:{ws_port}",
                            *[f"ws://{ip}:{ws_port}" for ip in local_ips]
                        ]
                    })
                    self.transport.sendto(response.encode('utf-8'), addr)
            except Exception as e:
                print(f"UDP datagram error: {e}")

    loop = asyncio.get_running_loop()
    try:
        transport, _ = await loop.create_datagram_endpoint(
            lambda: UDPDiscoveryProtocol(),
            local_addr=('0.0.0.0', 8888)
        )
        print(" [UDP] Discovery Service running on port 8888")
        return transport
    except Exception as e:
        print(f"[UDP WARNING] Could not start UDP Discovery Service on port 8888: {e}")
        return None

async def run_host_agent(on_qr_ready=None):
    auth = HostAuth()
    if not auth.google_user_id:
        env_email = os.getenv("GOOGLE_USER_EMAIL")
        env_user_id = os.getenv("GOOGLE_USER_ID")
        if env_email and env_user_id:
            auth.set_google_user(env_email, env_user_id)
        else:
            auth.google_user_id = f"guest_user_{uuid.uuid4().hex[:8]}"
            auth.google_email = f"guest_{uuid.uuid4().hex[:4]}@anyremote.local"
            print(f" [AUTH INFO] Host Agent running in Guest Mode ({auth.google_user_id}).")

    capturer = ScreenCapturer()
    display_mgr = DisplayManager()
    input_handler = InputHandler()

    tunnel_mgr = TunnelManager(port=8080)
    tunnel_mgr.start_tunnel()

    hostname = socket.gethostname()
    os_name_map = {"win32": "Windows", "darwin": "macOS", "linux": "Linux"}
    os_mapped = os_name_map.get(sys.platform, sys.platform)
    os_name = f"{os_mapped} ({hostname})"

    cached_local_ips = get_local_ip_addresses()

    def current_net_info():
        return {
            "local_ips": cached_local_ips,
            "ws_port": 8080,
            "usb_available": check_usb_adb_availability(),
            "public_tunnel_url": tunnel_mgr.get_wss_url()
        }

    print(f"==================================================")
    print(f" [HOST] Remote PC Host Agent Started")
    print(f" Host: {hostname} | OS: {sys.platform}")
    print(f" Local IPs: {cached_local_ips}")
    print(f" USB ADB Available: {check_usb_adb_availability()}")
    print(f" Registered Google ID: {auth.google_email} ({auth.google_user_id})")
    print(f" Connecting to Signaling Server: {SERVER_URI}")
    print(f"==================================================")

    tunnel_url = tunnel_mgr.wait_for_url(timeout=15)
    if not tunnel_url:
        print(" Tunnel URL timeout, proceeding with local IPs only.")
    primary_conn_url = tunnel_url or f"ws://{cached_local_ips[0]}:8080"
    # Generate QR and notify GUI via callback if provided
    qr_path = generate_host_qr(
        device_id=auth.device_id,
        device_name=hostname,
        primary_url=primary_conn_url,
        direct_urls=[f"ws://{ip}:8080" for ip in cached_local_ips]
    )
    if on_qr_ready and qr_path:
        on_qr_ready(qr_path)

    udp_transport = await start_udp_discovery_service(
        auth.device_id,
        hostname,
        auth.google_user_id,
        current_net_info
    )

    listener_task = None
    retry_delay = 3
    try:
        while True:
            if listener_task and not listener_task.done():
                listener_task.cancel()
            try:
                connect_time = time.time()
                async with websockets.connect(SERVER_URI) as ws:
                    res_info = display_mgr.get_current_resolution()
                    windows_list = capturer.list_windows()
                    monitors_list = capturer.list_monitors()
                    net_info = current_net_info()
                    net_info["monitors"] = monitors_list
                    reg_payload = {
                        "type": "register_host",
                        "google_user_id": auth.google_user_id,
                        "google_email": auth.google_email,
                        "device_id": auth.device_id,
                        "device_name": hostname,
                        "os": os_name,
                        "resolution": res_info,
                        "windows": windows_list,
                        "monitors": monitors_list,
                        "supported_resolutions": display_mgr.list_supported_resolutions(),
                        "network_info": net_info
                    }
                    await ws.send(json.dumps(reg_payload))
                    print(" Registered successfully with signaling server.")

                    async def message_listener():
                        async for raw_msg in ws:
                            try:
                                msg = json.loads(raw_msg)
                            except json.JSONDecodeError:
                                continue
                            msg_type = msg.get("type")

                            if msg_type == "input_event":
                                payload = msg.get("payload", {})
                                asyncio.get_running_loop().run_in_executor(None, input_handler.process_command, payload, capturer)

                            elif msg_type == "select_window":
                                handle = msg.get("handle")
                                capturer.set_target_window(handle)
                                print(f" Target capture switched to window handle: {handle}")

                            elif msg_type == "select_monitor":
                                mon_idx = msg.get("index", 1)
                                ok, res_msg = capturer.set_target_monitor(mon_idx)
                                print(f" Monitor switch result: {res_msg}")

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

                            elif msg_type == "zoom_region":
                                capturer.set_zoom_roi(msg)

                            elif msg_type == "request_windows":
                                updated_windows = capturer.list_windows()
                                updated_monitors = capturer.list_monitors()
                                await ws.send(json.dumps({
                                    "type": "windows_list_update",
                                    "windows": updated_windows,
                                    "monitors": updated_monitors
                                }))

                    listener_task = asyncio.create_task(message_listener())

                    while True:
                        if listener_task.done():
                            # If listener encountered error or finished, break out of loop
                            exc = listener_task.exception()
                            if exc:
                                raise exc
                            break

                        if time.time() - connect_time > 15:
                            retry_delay = 3

                        if capturer.is_background:
                            await ws.send(json.dumps({"type": "ping", "device_id": auth.device_id}))
                            await asyncio.sleep(2.0)
                        else:
                            frame_bytes = await asyncio.get_running_loop().run_in_executor(
                                            None, capturer.capture_frame, 1920, 82
                                        )
                            if frame_bytes:
                                b64_frame = base64.b64encode(frame_bytes).decode('utf-8')
                                frame_packet = {
                                    "type": "screen_frame",
                                    "device_id": auth.device_id,
                                    "frame": b64_frame
                                }
                                await ws.send(json.dumps(frame_packet))
                            await asyncio.sleep(0.04)

            except Exception as err:
                if listener_task and not listener_task.done():
                    listener_task.cancel()
                input_handler.release_stuck_buttons()
                print(f"[WARNING] Connection lost/error: {err}. Reconnecting in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(60, retry_delay * 2)
    finally:
        if udp_transport:
            udp_transport.close()
        try:
            capturer.close()
        except Exception:
            pass
        try:
            tunnel_mgr.stop()
        except Exception:
            pass
        input_handler.release_stuck_buttons()

if __name__ == "__main__":
    try:
        asyncio.run(run_host_agent())
    except KeyboardInterrupt:
        print("Host agent stopped.")
