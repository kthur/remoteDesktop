"""
AnyRemote PC Host Agent - Single EXE Build Script
빌드 결과: dist/AnyRemote_Host.exe (단일 파일)

사용법:
    python build_exe.py

요구 조건:
    pip install pyinstaller pyinstaller-hooks-contrib
    pip install -r host_agent/requirements.txt
"""

import os
import sys
import subprocess
import shutil


def check_and_install_pyinstaller():
    try:
        import PyInstaller
        print(f"[OK] PyInstaller {PyInstaller.__version__} found")
    except ImportError:
        print("[INFO] Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install",
                               "pyinstaller", "pyinstaller-hooks-contrib"])


def check_host_agent_deps():
    """Install all host_agent requirements."""
    req_path = os.path.join("host_agent", "requirements.txt")
    print(f"[INFO] Installing host_agent dependencies from {req_path}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_path])


def build_exe():
    print("=" * 56)
    print("  [BUILD] AnyRemote Host Agent - Single EXE Builder")
    print("=" * 56)

    check_and_install_pyinstaller()
    check_host_agent_deps()

    spec_path = os.path.abspath("AnyRemote_Host.spec")
    host_agent_dir = os.path.abspath("host_agent")
    dist_dir = os.path.abspath("dist")
    build_dir = os.path.abspath("build")

    # Clean previous build artifacts
    for d in [build_dir, dist_dir]:
        if os.path.exists(d):
            shutil.rmtree(d)
            print(f"[INFO] Cleaned: {d}")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        spec_path,
    ]

    env = os.environ.copy()
    env["PYTHONPATH"] = host_agent_dir + os.pathsep + env.get("PYTHONPATH", "")

    print(f"\n[INFO] Running PyInstaller...")
    print(f"       Spec: {spec_path}")
    print()

    result = subprocess.run(cmd, env=env)

    if result.returncode != 0:
        print("\n[ERROR] Build failed! Check the output above.")
        sys.exit(1)

    output_exe = os.path.join(dist_dir, "AnyRemote_Host.exe")
    if os.path.exists(output_exe):
        size_mb = os.path.getsize(output_exe) / (1024 * 1024)
        print("\n" + "=" * 56)
        print("  [SUCCESS] Build Complete!")
        print(f"  Output : {output_exe}")
        print(f"  Size   : {size_mb:.1f} MB")
        print("=" * 56)
        print()
        print("  실행 방법:")
        print("    dist\\AnyRemote_Host.exe 를 더블클릭하여 실행")
        print()
        print("  배포 방법:")
        print("    AnyRemote_Host.exe 파일 하나만 복사하면 됩니다.")
        print("    host_config.json은 EXE와 같은 폴더에 자동 생성됩니다.")
        print("=" * 56)
    else:
        print(f"\n[ERROR] Expected EXE not found at: {output_exe}")
        sys.exit(1)


if __name__ == "__main__":
    build_exe()
