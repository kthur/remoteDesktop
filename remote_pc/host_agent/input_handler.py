import sys
import pyautogui
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController

# Fail safe setting for PyAutoGUI
pyautogui.FAILSAFE = False

class InputHandler:
    """Processes normalized remote input commands from mobile client and injects into OS"""
    def __init__(self):
        self.mouse = MouseController()
        self.keyboard = KeyboardController()

    def process_command(self, cmd, capturer=None):
        """Processes input command packet:
        cmd structure:
        {
           "type": "move" | "click" | "rclick" | "dclick" | "mousedown" | "mouseup" | "scroll" | "key" | "text",
           "x": 0.5, "y": 0.5, # Normalized [0, 1] relative to capture region
           "dx": 0, "dy": 10,  # Scroll delta
           "key": "a" | "enter" | "backspace",
           "text": "Hello world"
        }
        """
        cmd_type = cmd.get("type")
        norm_x = cmd.get("x", 0.5)
        norm_y = cmd.get("y", 0.5)

        # Calculate actual screen/window coordinates
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
                # Scroll up or down
                pyautogui.scroll(int(dy * 10), x=abs_x, y=abs_y)
            elif cmd_type == "key":
                key_val = cmd.get("key")
                if key_val:
                    self._send_key(key_val)
            elif cmd_type == "text":
                text_str = cmd.get("text")
                if text_str:
                    pyautogui.write(text_str)
        except Exception as e:
            print(f"Input injection error: {e}")

    def _get_absolute_coords(self, norm_x, norm_y, capturer=None):
        """Converts [0.0 - 1.0] normalized mobile touch coordinates to OS screen pixel coordinates"""
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

        screen_w, screen_h = pyautogui.size()
        abs_x = int(norm_x * screen_w)
        abs_y = int(norm_y * screen_h)
        return abs_x, abs_y

    def _send_key(self, key_name):
        key_map = {
            "enter": Key.enter,
            "backspace": Key.backspace,
            "tab": Key.tab,
            "space": Key.space,
            "esc": Key.esc,
            "up": Key.up,
            "down": Key.down,
            "left": Key.left,
            "right": Key.right,
        }
        if key_name.lower() in key_map:
            self.keyboard.press(key_map[key_name.lower()])
            self.keyboard.release(key_map[key_name.lower()])
        else:
            self.keyboard.type(key_name)
