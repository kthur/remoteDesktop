import sys
import ctypes

if sys.platform == "win32":
    import win32api
    import win32con

class DisplayManager:
    """Handles Host PC screen resolution discovery, mode switching, and fit matching"""
    def __init__(self):
        pass

    def get_current_resolution(self):
        """Returns current display width, height, refresh rate"""
        if sys.platform == "win32":
            w = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
            h = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
            return {"width": w, "height": h}
        else:
            return {"width": 1920, "height": 1080}

    def list_supported_resolutions(self):
        """Lists available screen resolutions supported by display driver"""
        resolutions = []
        seen = set()

        if sys.platform == "win32":
            i = 0
            while True:
                try:
                    devmode = win32api.EnumDisplaySettings(None, i)
                    if not devmode:
                        break
                    res_tuple = (devmode.PelsWidth, devmode.PelsHeight)
                    if res_tuple not in seen:
                        seen.add(res_tuple)
                        resolutions.append({
                            "width": devmode.PelsWidth,
                            "height": devmode.PelsHeight,
                            "label": f"{devmode.PelsWidth} x {devmode.PelsHeight}"
                        })
                    i += 1
                except Exception:
                    break
        else:
            # Default common resolutions
            resolutions = [
                {"width": 1920, "height": 1080, "label": "1920 x 1080 (16:9)"},
                {"width": 1600, "height": 900, "label": "1600 x 900 (16:9)"},
                {"width": 1366, "height": 768, "label": "1366 x 768 (16:9)"},
                {"width": 1280, "height": 720, "label": "1280 x 720 (16:9)"},
                {"width": 2400, "height": 1080, "label": "2400 x 1080 (Mobile 20:9)"},
                {"width": 2340, "height": 1080, "label": "2340 x 1080 (Mobile 19.5:9)"},
            ]

        # Sort descending by area
        resolutions.sort(key=lambda x: x["width"] * x["height"], reverse=True)
        return resolutions

    def change_resolution(self, width, height):
        """Changes Windows display resolution to target width x height"""
        if sys.platform == "win32":
            try:
                devmode = win32api.EnumDisplaySettings(None, win32con.ENUM_CURRENT_SETTINGS)
                devmode.PelsWidth = int(width)
                devmode.PelsHeight = int(height)
                devmode.Fields = win32con.DM_PELSWIDTH | win32con.DM_PELSHEIGHT

                result = win32api.ChangeDisplaySettings(devmode, 0)
                if result == win32con.DISP_CHANGE_SUCCESSFUL:
                    print(f"Resolution changed successfully to {width}x{height}")
                    return True, f"Success: Changed to {width}x{height}"
                else:
                    print(f"Failed to change resolution. Error code: {result}")
                    return False, f"Resolution change failed with status code {result}"
            except Exception as e:
                return False, f"Exception changing resolution: {str(e)}"
        else:
            return True, f"Simulated resolution change on non-Windows to {width}x{height}"

    def fit_mobile_resolution(self, mobile_width, mobile_height):
        """Matches PC resolution to best supported resolution for mobile aspect ratio"""
        target_ratio = mobile_width / mobile_height if mobile_height else 16/9
        supported = self.list_supported_resolutions()

        # Find resolution with closest aspect ratio
        best_match = None
        best_diff = float('inf')

        for res in supported:
            ratio = res["width"] / res["height"]
            diff = abs(ratio - target_ratio)
            if diff < best_diff:
                best_diff = diff
                best_match = res

        if best_match:
            return self.change_resolution(best_match["width"], best_match["height"])
        return False, "No matching resolution found"
