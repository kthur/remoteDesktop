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

    host_agent_dir = os.path.abspath("host_agent")
    script_path = os.path.join(host_agent_dir, "gui_launcher.py")

    add_data_arg = f"--add-data={host_agent_dir}{os.pathsep}host_agent"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=AnyRemote_Host",
        f"--paths={host_agent_dir}",
        add_data_arg,
        "--clean",
        script_path
    ]

    env = os.environ.copy()
    env["PYTHONPATH"] = host_agent_dir + os.pathsep + env.get("PYTHONPATH", "")

    print(f"Executing build command: {' '.join(cmd)}")
    subprocess.check_call(cmd, env=env)

    print("\n==================================================")
    print(" 🎉 SUCCESS! Standalone App executable created at:")
    print(f"    {os.path.abspath('dist/AnyRemote_Host/AnyRemote_Host.exe')}")
    print("==================================================")

if __name__ == "__main__":
    build_exe()
