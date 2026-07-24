import sys
import time
import io
import base64
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import mss
except ImportError:
    mss = None

if sys.platform == "win32":
    try:
        import win32gui
        import win32process
        import win32con
    except ImportError:
        win32gui = None
    try:
        import pygetwindow as gw
    except ImportError:
        gw = None
else:
    gw = None

class ScreenCapturer:
    def __init__(self):
        self.sct = mss.mss() if mss else None
        self.selected_window_handle = None
        self.is_full_desktop = True
        self.is_background = False  # App background state flag

    def list_windows(self):
        """Enumerates visible active windows with title and position"""
        windows = []
        mon_w, mon_h = 1920, 1080
        if self.sct and self.sct.monitors:
            monitor = self.sct.monitors[1] if len(self.sct.monitors) > 1 else self.sct.monitors[0]
            mon_w, mon_h = monitor["width"], monitor["height"]

        windows.append({
            "handle": 0,
            "title": f"🖥️ Full Desktop ({mon_w}x{mon_h})",
            "width": mon_w,
            "height": mon_h,
            "is_desktop": True
        })

        if sys.platform == "win32" and win32gui:
            def enum_windows_callback(hwnd, extra):
                if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd):
                    title = win32gui.GetWindowText(hwnd)
                    if title and title not in ["Program Manager", "Task Switching", "Settings", "Cortana"]:
                        rect = win32gui.GetWindowRect(hwnd)
                        w = rect[2] - rect[0]
                        h = rect[3] - rect[1]
                        if w > 100 and h > 100:
                            extra.append({
                                "handle": hwnd,
                                "title": title,
                                "width": w,
                                "height": h,
                                "is_desktop": False
                            })
                return True

            win_list = []
            win32gui.EnumWindows(enum_windows_callback, win_list)
            windows.extend(win_list)

        return windows

    def set_target_window(self, handle):
        """Sets target capture source: handle 0 for full desktop, otherwise window handle"""
        if handle == 0 or handle is None:
            self.is_full_desktop = True
            self.selected_window_handle = None
        else:
            self.is_full_desktop = False
            self.selected_window_handle = handle

    def capture_frame(self, target_width=None, quality=70):
        """Captures frame from desktop or selected window, returns JPEG bytes"""
        if self.is_background or not self.sct or not cv2:
            return None

        bbox = None
        if self.is_full_desktop or not self.selected_window_handle:
            monitor = self.sct.monitors[1] if len(self.sct.monitors) > 1 else self.sct.monitors[0]
            bbox = monitor
        else:
            if sys.platform == "win32" and self.selected_window_handle and win32gui:
                try:
                    rect = win32gui.GetWindowRect(self.selected_window_handle)
                    left, top, right, bottom = rect
                    w = max(1, right - left)
                    h = max(1, bottom - top)
                    bbox = {"top": top, "left": left, "width": w, "height": h}
                except Exception as e:
                    self.is_full_desktop = True
                    bbox = self.sct.monitors[1] if len(self.sct.monitors) > 1 else self.sct.monitors[0]
            else:
                bbox = self.sct.monitors[1] if len(self.sct.monitors) > 1 else self.sct.monitors[0]

        try:
            sct_img = self.sct.grab(bbox)
            img = np.array(sct_img)
            img_bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

            h, w = img_bgr.shape[:2]
            if target_width and target_width < w:
                target_height = int(h * (target_width / w))
                img_bgr = cv2.resize(img_bgr, (target_width, target_height), interpolation=cv2.INTER_AREA)

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            _, jpeg_buffer = cv2.imencode('.jpg', img_bgr, encode_param)
            return jpeg_buffer.tobytes()
        except Exception as e:
            try:
                from PIL import ImageGrab
                pil_img = ImageGrab.grab()
                img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                h, w = img_bgr.shape[:2]
                if target_width and target_width < w:
                    target_height = int(h * (target_width / w))
                    img_bgr = cv2.resize(img_bgr, (target_width, target_height), interpolation=cv2.INTER_AREA)
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
                _, jpeg_buffer = cv2.imencode('.jpg', img_bgr, encode_param)
                return jpeg_buffer.tobytes()
            except Exception as ex:
                print(f"Capture error: {e} | Fallback error: {ex}")
                return None
