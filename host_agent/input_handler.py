import sys

try:
    import pyautogui
    pyautogui.FAILSAFE = False
except ImportError:
    pyautogui = None

try:
    from pynput.mouse import Button, Controller as MouseController
    from pynput.keyboard import Key, Controller as KeyboardController
except ImportError:
    MouseController = None
    KeyboardController = None

class InputHandler:
    """Processes normalized remote input commands from mobile client and injects into OS"""
    def __init__(self):
        self.mouse = MouseController() if MouseController else None
        self.keyboard = KeyboardController() if KeyboardController else None

    def process_command(self, cmd, capturer=None):
        if not pyautogui:
            return

        cmd_type = cmd.get("type")
        norm_x = cmd.get("x", 0.5)
        norm_y = cmd.get("y", 0.5)

        abs_x, abs_y = self._get_absolute_coords(norm_x, norm_y, capturer)

        try:
            if cmd_type == "move":
                pyautogui.moveTo(abs_x, abs_y)
            elif cmd_type == "click":
                pyautogui.click(abs_x, abs_y)
            elif cmd_type == "rclick":
                pyautogui.rightClick(abs_x, abs_y)
            elif cmd_type == "dclick":
                pyautogui.doubleClick(abs_x, abs_y)
            elif cmd_type == "mousedown":
                pyautogui.mouseDown(abs_x, abs_y, button='left')
            elif cmd_type == "mouseup":
                pyautogui.mouseUp(abs_x, abs_y, button='left')
            elif cmd_type == "scroll":
                dy = cmd.get("dy", 0)
                pyautogui.scroll(int(dy * 10), x=abs_x, y=abs_y)
            elif cmd_type == "key":
                key_val = cmd.get("key")
                if key_val:
                    self._send_key(key_val)
            elif cmd_type == "shortcut":
                action = cmd.get("action")
                if action:
                    self._send_shortcut(action)
            elif cmd_type == "text":
                text_str = cmd.get("text")
                if text_str:
                    pyautogui.write(text_str)
        except Exception as e:
            print(f"Input injection error: {e}")

    def _get_absolute_coords(self, norm_x, norm_y, capturer=None):
        if capturer and not capturer.is_full_desktop and capturer.selected_window_handle:
            if sys.platform == "win32":
                import win32gui
                try:
                    rect = win32gui.GetWindowRect(capturer.selected_window_handle)
                    left, top, right, bottom = rect
                    w = right - left
                    h = bottom - top
                    abs_x = left + int(norm_x * w)
                    abs_y = top + int(norm_y * h)
                    return abs_x, abs_y
                except Exception:
                    pass

        screen_w, screen_h = pyautogui.size() if pyautogui else (1920, 1080)
        abs_x = int(norm_x * screen_w)
        abs_y = int(norm_y * screen_h)
        return abs_x, abs_y

    def _send_shortcut(self, shortcut_name):
        s = shortcut_name.lower()
        if s == "win_d":
            pyautogui.hotkey('win', 'd')
        elif s == "alt_tab":
            pyautogui.hotkey('alt', 'tab')
        elif s == "ctrl_z":
            pyautogui.hotkey('ctrl', 'z')
        elif s == "ctrl_c":
            pyautogui.hotkey('ctrl', 'c')
        elif s == "ctrl_v":
            pyautogui.hotkey('ctrl', 'v')
        elif s == "win":
            pyautogui.press('win')
        elif s in ["enter", "backspace", "tab", "space", "esc", "up", "down", "left", "right", "delete"]:
            pyautogui.press(s)
        else:
            self._send_key(shortcut_name)

    def _send_key(self, key_name):
        if not self.keyboard:
            return
        key_map = {
            "enter": Key.enter if Key else None,
            "backspace": Key.backspace if Key else None,
            "tab": Key.tab if Key else None,
            "space": Key.space if Key else None,
            "esc": Key.esc if Key else None,
            "up": Key.up if Key else None,
            "down": Key.down if Key else None,
            "left": Key.left if Key else None,
            "right": Key.right if Key else None,
            "delete": Key.delete if Key else None,
        }
        target = key_map.get(key_name.lower())
        if target:
            self.keyboard.press(target)
            self.keyboard.release(target)
        else:
            if pyautogui:
                pyautogui.press(key_name)
