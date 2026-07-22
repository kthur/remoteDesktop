import os
import sys
import subprocess

def build_exe():
    print("==================================================")
    print(" 🛠️  Building Standalone PC Host Executable (.exe)")
    print("==================================================")

    # Check if PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    script_path = os.path.join("host_agent", "gui_launcher.py")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=AnyRemote_Host",
        "--add-data=host_agent;host_agent",
        "--clean",
        script_path
    ]

    print(f"Executing build command: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    print("\n==================================================")
    print(" 🎉 SUCCESS! Standalone App executable created at:")
    print(f"    {os.path.abspath('dist/AnyRemote_Host/AnyRemote_Host.exe')}")
    print("==================================================")

if __name__ == "__main__":
    build_exe()
