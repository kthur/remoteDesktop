import os
import sys
import subprocess

def build_exe():
    print("==================================================")
    print(" 🛠️  Building Standalone PC Host Executable (.exe)")
    print("==================================================")

    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    script_path = os.path.join("host_agent", "gui_launcher.py")

    add_data_arg = f"--add-data=host_agent{os.pathsep}host_agent"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=AnyRemote_Host",
        add_data_arg,
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
