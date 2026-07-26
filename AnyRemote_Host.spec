# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec File for AnyRemote PC Host Agent
Single-file EXE build: AnyRemote_Host.exe
"""

import sys
import os

block_cipher = None

# Collect all host_agent python source files
host_agent_dir = os.path.join(SPECPATH, 'host_agent')

a = Analysis(
    [os.path.join(host_agent_dir, 'gui_launcher.py')],
    pathex=[host_agent_dir, SPECPATH],
    binaries=[],
    datas=[],
    hiddenimports=[
        # Async / networking
        'asyncio',
        'asyncio.events',
        'asyncio.futures',
        'asyncio.tasks',
        'websockets',
        'websockets.legacy',
        'websockets.legacy.client',
        'websockets.legacy.server',
        'websockets.connection',
        'websockets.frames',
        'websockets.http11',
        'websockets.streams',
        # Screen capture
        'mss',
        'mss.windows',
        'mss.base',
        'cv2',
        'PIL',
        'PIL.Image',
        'PIL.ImageGrab',
        'numpy',
        'numpy.core',
        'numpy.core._methods',
        'numpy.lib.format',
        # Input control
        'pyautogui',
        'pynput',
        'pynput.keyboard',
        'pynput.mouse',
        'pynput._util',
        'pynput._util.win32',
        'pynput.keyboard._win32',
        'pynput.mouse._win32',
        # Clipboard
        'pyperclip',
        # Windows API
        'win32api',
        'win32con',
        'win32gui',
        'win32process',
        'win32security',
        'pywintypes',
        # QR code
        'qrcode',
        'qrcode.image',
        'qrcode.image.pil',
        'qrcode.image.styledpil',
        # Google auth
        'google.auth',
        'google.auth.transport',
        'google.oauth2',
        # Misc
        'socket',
        'threading',
        'json',
        'base64',
        'hashlib',
        'uuid',
        'subprocess',
        'shutil',
        'struct',
        'platform',
        'tkinter',
        'tkinter.ttk',
        'tkinter.messagebox',
        # Host agent modules
        'main',
        'auth_host',
        'screen_capturer',
        'input_handler',
        'display_manager',
        'tunnel_manager',
        'qr_generator',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'scipy',
        'pandas',
        'IPython',
        'notebook',
        'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='AnyRemote_Host',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # GUI mode: no console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,              # Add icon path here if available: icon='assets/icon.ico'
    version=None,
    uac_admin=False,        # Set True if UAC elevation needed
)
