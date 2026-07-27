import sys
import time
import io
import base64
try:
    import numpy as np
except ImportError:
    np = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import mss
except ImportError:
    mss = None

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None

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

    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            import ctypes
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass
else:
    gw = None

class ScreenCapturer:
    def __init__(self):
        self.sct = mss.mss() if mss else None
        self.selected_window_handle = None
        self.is_full_desktop = True
        self.is_background = False  # App background state flag
        self.zoom_roi = None        # ROI dict: {'x': float, 'y': float, 'w': float, 'h': float, 'scale': float}

    def close(self):
        if self.sct:
            try:
                self.sct.close()
            except Exception:
                pass

    def set_zoom_roi(self, roi):
        """Sets active zoom ROI crop box from client"""
        if roi and roi.get('scale', 1.0) > 1.15:
            self.zoom_roi = roi
        else:
            self.zoom_roi = None

    def list_windows(self):
        """Enumerates visible active windows with title and position"""
        windows = []
        mon_w, mon_h = 1920, 1080
        if self.sct and self.sct.monitors:
            monitor = self.sct.monitors[0]
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
        if self.is_background:
            return None

        # 1. Primary capturer: mss + cv2
        if self.sct and cv2:
            try:
                bbox = None
                if self.is_full_desktop or not self.selected_window_handle:
                    bbox = self.sct.monitors[0]
                else:
                    if sys.platform == "win32" and self.selected_window_handle and win32gui:
                        try:
                            rect = win32gui.GetWindowRect(self.selected_window_handle)
                            left, top, right, bottom = rect
                            w = max(1, right - left)
                            h = max(1, bottom - top)
                            bbox = {"top": top, "left": left, "width": w, "height": h}
                        except Exception as e:
                            print(f"Window capture error: {e}")
                            bbox = self.sct.monitors[0]
                    else:
                        bbox = self.sct.monitors[0]

                sct_img = self.sct.grab(bbox)
                if np is None:
                    print("numpy is not installed, cannot use mss")
                    raise ImportError("numpy is required for mss capture")
                img = np.array(sct_img)
                img_bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

                h, w = img_bgr.shape[:2]

                # ── Apply ROI Crop if zoomed ──────────────────────────────────────
                current_quality = quality
                if self.zoom_roi and self.zoom_roi.get('scale', 1.0) > 1.15:
                    rx = max(0.0, min(1.0, self.zoom_roi.get('x', 0.0)))
                    ry = max(0.0, min(1.0, self.zoom_roi.get('y', 0.0)))
                    rw = max(0.05, min(1.0, self.zoom_roi.get('w', 1.0)))
                    rh = max(0.05, min(1.0, self.zoom_roi.get('h', 1.0)))

                    x1 = int(w * rx)
                    y1 = int(h * ry)
                    w1 = max(16, int(w * rw))
                    h1 = max(16, int(h * rh))

                    # Crop region of interest
                    crop_bgr = img_bgr[y1:min(h, y1 + h1), x1:min(w, x1 + w1)]
                    if crop_bgr.size > 0:
                        ch, cw = crop_bgr.shape[:2]
                        # Resize zoomed ROI using high-sharpness Lanczos4 interpolation
                        target_w = target_width or 1920
                        target_h = int(ch * (target_w / cw))
                        img_bgr = cv2.resize(crop_bgr, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
                        current_quality = max(92, quality) # Upgrade JPEG quality for zoomed text sharpness

                elif target_width and target_width < w:
                    target_height = int(h * (target_width / w))
                    img_bgr = cv2.resize(img_bgr, (target_width, target_height), interpolation=cv2.INTER_AREA)

                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), current_quality]
                _, jpeg_buffer = cv2.imencode('.jpg', img_bgr, encode_param)
                if jpeg_buffer is not None:
                    return jpeg_buffer.tobytes()
            except Exception as e:
                print(f"Primary capture error: {e}, falling back to PIL...")

        # 2. Fallback capturer: PIL ImageGrab
        if ImageGrab:
            try:
                pil_img = ImageGrab.grab(all_screens=True)
                current_quality = quality
                if self.zoom_roi and self.zoom_roi.get('scale', 1.0) > 1.15:
                    pw, ph = pil_img.width, pil_img.height
                    rx = max(0.0, min(1.0, self.zoom_roi.get('x', 0.0)))
                    ry = max(0.0, min(1.0, self.zoom_roi.get('y', 0.0)))
                    rw = max(0.05, min(1.0, self.zoom_roi.get('w', 1.0)))
                    rh = max(0.05, min(1.0, self.zoom_roi.get('h', 1.0)))
                    box = (int(pw * rx), int(ph * ry), int(pw * (rx + rw)), int(ph * (ry + rh)))
                    pil_img = pil_img.crop(box)
                    if target_width:
                        target_height = int(pil_img.height * (target_width / pil_img.width))
                        pil_img = pil_img.resize((target_width, target_height))
                    current_quality = max(92, quality)
                elif target_width and target_width < pil_img.width:
                    target_height = int(pil_img.height * (target_width / pil_img.width))
                    pil_img = pil_img.resize((target_width, target_height))
                buf = io.BytesIO()
                pil_img.save(buf, format='JPEG', quality=current_quality)
                return buf.getvalue()
            except Exception as e:
                print(f"Fallback capture error: {e}")

        return None
