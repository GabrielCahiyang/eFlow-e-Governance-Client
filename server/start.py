"""Start and supervise the eFlow control gateway on port 8322."""

from hashlib import sha256
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


SERVER_DIR = Path(__file__).resolve().parent
from services.proxy_config import trusted_proxy_ips
VENV_DIR = SERVER_DIR / ".venv"
PYTHON = VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
REQUIREMENTS = SERVER_DIR / "requirements.txt"
REQUIREMENTS_MARKER = VENV_DIR / ".requirements.sha256"
HEALTH_URL = "http://127.0.0.1:8322/controlpanelEflow/api/health"


def _requirements_hash() -> str:
    return sha256(REQUIREMENTS.read_bytes()).hexdigest()


def _is_venv_valid() -> bool:
    if not PYTHON.exists():
        return False
    try:
        result = subprocess.run(
            [str(PYTHON), "-c", "import sys"],
            capture_output=True,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _prepare_runtime() -> None:
    if not _is_venv_valid():
        print(f"[GATEWAY] Creating isolated Python environment at {VENV_DIR}", flush=True)
        subprocess.run([sys.executable, "-m", "venv", "--clear", str(VENV_DIR)], check=True)
        if REQUIREMENTS_MARKER.exists():
            REQUIREMENTS_MARKER.unlink()

    current_hash = _requirements_hash()
    installed_hash = (
        REQUIREMENTS_MARKER.read_text(encoding="utf-8").strip()
        if REQUIREMENTS_MARKER.exists()
        else ""
    )
    if installed_hash == current_hash:
        return

    print("[GATEWAY] Installing gateway dependencies", flush=True)
    subprocess.run(
        [str(PYTHON), "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        check=True,
    )
    REQUIREMENTS_MARKER.write_text(current_hash, encoding="utf-8")


def _gateway_is_healthy() -> bool:
    try:
        with urlopen(HEALTH_URL, timeout=1.5) as response:
            if response.status != 200:
                return False
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("service") == "eflow-control-gateway"
    except (OSError, URLError, ValueError, json.JSONDecodeError):
        return False


def _port_is_listening() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(0.5)
        return connection.connect_ex(("127.0.0.1", 8322)) == 0


def _replace_existing_gateway() -> None:
    """Stop only the verified eFlow gateway occupying its dedicated port."""
    if not _port_is_listening():
        return
    if not _gateway_is_healthy():
        raise RuntimeError(
            "Port 8322 is occupied by an application that is not the eFlow gateway."
        )

    print("[GATEWAY] Replacing the previous eFlow gateway on port 8322", flush=True)
    if os.name == "nt":
        result = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        gateway_pids = {
            line.strip().split()[-1]
            for line in result.stdout.splitlines()
            if "127.0.0.1:8322" in line and "LISTENING" in line
        }
        for pid in gateway_pids:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", pid],
                capture_output=True,
                timeout=10,
                check=False,
            )
    else:
        result = subprocess.run(
            ["lsof", "-ti", ":8322"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        for pid in result.stdout.split():
            os.kill(int(pid), signal.SIGTERM)

    deadline = time.monotonic() + 10
    while _port_is_listening() and time.monotonic() < deadline:
        time.sleep(0.2)
    if _port_is_listening():
        raise RuntimeError("The previous eFlow gateway did not release port 8322.")


def main() -> int:
    _prepare_runtime()
    try:
        _replace_existing_gateway()
    except RuntimeError as exc:
        print(f"[GATEWAY] {exc}", file=sys.stderr, flush=True)
        return 1

    reload_enabled = "--reload" in sys.argv[1:]
    print(
        f"[GATEWAY] Starting eFlow control gateway on http://127.0.0.1:8322"
        f"{' with code reload' if reload_enabled else ''}",
        flush=True,
    )
    command = [
        str(PYTHON),
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8322",
        "--forwarded-allow-ips",
        trusted_proxy_ips(),
    ]
    if reload_enabled:
        command.extend(["--reload", "--reload-dir", str(SERVER_DIR)])
    process = subprocess.Popen(
        command,
        cwd=str(SERVER_DIR),
    )

    stopping = False

    def stop_gateway(*_args) -> None:
        nonlocal stopping
        stopping = True
        if process.poll() is None:
            process.terminate()

    signal.signal(signal.SIGINT, stop_gateway)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop_gateway)

    try:
        while process.poll() is None and not stopping:
            time.sleep(0.5)
    except KeyboardInterrupt:
        stop_gateway()
    finally:
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
    return process.returncode or 0


if __name__ == "__main__":
    raise SystemExit(main())
