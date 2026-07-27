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

try:
    import pyperclip
except ImportError:
    pyperclip = None

class InputHandler:
    """Processes normalized remote input commands from mobile client and injects into OS"""
    def __init__(self):
        self.keyboard = KeyboardController() if KeyboardController else None
        self._mouse_pressed = False

    def release_stuck_buttons(self):
        if pyautogui:
            try:
                pyautogui.mouseUp(button='left')
                pyautogui.mouseUp(button='right')
                pyautogui.mouseUp(button='middle')
                pyautogui.keyUp('ctrl')
                pyautogui.keyUp('alt')
                pyautogui.keyUp('shift')
                pyautogui.keyUp('win')
            except Exception:
                pass
        self._mouse_pressed = False

    def process_command(self, cmd, capturer=None):
        if not pyautogui:
            return

        cmd_type = cmd.get("type")
        norm_x = cmd.get("x", 0.5)
        norm_y = cmd.get("y", 0.5)

        abs_x, abs_y = self._get_absolute_coords(norm_x, norm_y, capturer)

        try:
            if cmd_type == "move":
                if self._mouse_pressed:
                    pyautogui.dragTo(abs_x, abs_y, button='left')
                else:
                    pyautogui.moveTo(abs_x, abs_y)
            elif cmd_type == "click":
                pyautogui.click(abs_x, abs_y)
            elif cmd_type == "rclick":
                pyautogui.rightClick(abs_x, abs_y)
            elif cmd_type == "dclick":
                pyautogui.doubleClick(abs_x, abs_y)
            elif cmd_type == "mousedown":
                pyautogui.mouseDown(abs_x, abs_y, button='left')
                self._mouse_pressed = True
            elif cmd_type == "mouseup":
                pyautogui.mouseUp(abs_x, abs_y, button='left')
                self._mouse_pressed = False
            elif cmd_type == "scroll":
                dy = cmd.get("dy", 0)
                pyautogui.scroll(-int(dy * 120), x=int(abs_x), y=int(abs_y))
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
                    if pyperclip:
                        try:
                            pyperclip.copy(text_str)
                            pyautogui.hotkey('ctrl', 'v')
                        except Exception:
                            pyautogui.write(text_str)
                    else:
                        pyautogui.write(text_str)
        except Exception as e:
            print(f"Input injection error: {e}")

    def _get_absolute_coords(self, norm_x, norm_y, capturer=None):
        if capturer and not capturer.is_full_desktop and capturer.selected_window_handle:
            if sys.platform == "win32":
                import win32gui
                try:
                    hwnd = capturer.selected_window_handle
                    if win32gui.IsWindow(hwnd) and not win32gui.IsIconic(hwnd):
                        client_rect = win32gui.GetClientRect(hwnd)
                        top_left = win32gui.ClientToScreen(hwnd, (0, 0))
                        left, top = top_left
                        w = client_rect[2] - client_rect[0]
                        h = client_rect[3] - client_rect[1]
                        if w > 0 and h > 0:
                            abs_x = left + int(norm_x * w)
                            abs_y = top + int(norm_y * h)
                            return abs_x, abs_y
                except Exception:
                    pass

        if sys.platform == "win32":
            try:
                import win32api
                import win32con
                vx = win32api.GetSystemMetrics(win32con.SM_XVIRTUALSCREEN)
                vy = win32api.GetSystemMetrics(win32con.SM_YVIRTUALSCREEN)
                vw = win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN)
                vh = win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN)
                if vw > 0 and vh > 0:
                    abs_x = vx + int(norm_x * vw)
                    abs_y = vy + int(norm_y * vh)
                    return abs_x, abs_y
            except Exception:
                pass

        screen_w, screen_h = pyautogui.size() if pyautogui else (1920, 1080)
        abs_x = int(norm_x * screen_w)
        abs_y = int(norm_y * screen_h)
        abs_x = max(0, min(screen_w - 1, abs_x))
        abs_y = max(0, min(screen_h - 1, abs_y))
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
            if self.keyboard and Key:
                self.keyboard.press(Key.cmd)
                self.keyboard.release(Key.cmd)
            else:
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
