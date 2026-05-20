from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import NoReturn


ROOT_DIR = Path(__file__).resolve().parent
SUPPORTED_PYTHON_VERSIONS = ((3, 12), (3, 11))
REQUIRED_FRONTEND_OUTPUTS = (
    Path("src/ui/scripts/pankki.js"),
    Path("src/ui/scripts/quiz.js"),
    Path("src/ui/scripts/ulkoasu.js"),
    Path("src/ui/scripts/opintopolut.js"),
    Path("src/ui/scripts/tutkinto-kysely.js"),
    Path("src/ui/scripts/tallennetut.js"),
    Path("src/ui/scripts/asetukset.js"),
    Path("src/ui/scripts/tutkintonimike-kortti.js"),
)


def log(message: str) -> None:
    print(f"[INFO] {message}")


def fail(message: str) -> NoReturn:
    raise SystemExit(f"[ERROR] {message}")


def is_supported_python(version_info: tuple[int, int] | None = None) -> bool:
    current = version_info or sys.version_info[:2]
    return current in SUPPORTED_PYTHON_VERSIONS


def python_version_label(version_info: tuple[int, int] | None = None) -> str:
    major, minor = version_info or sys.version_info[:2]
    return f"{major}.{minor}"


def resolve_executable(command_name: str) -> str:
    resolved = shutil.which(command_name)
    if resolved:
        return resolved
    fail(f"Komentoa ei loytynyt PATH-ymparistosta: {command_name}")


def run_checked(command: list[str], *, cwd: Path | None = None) -> None:
    resolved_command = [resolve_executable(command[0]), *command[1:]]
    completed = subprocess.run(resolved_command, cwd=cwd or ROOT_DIR)
    if completed.returncode != 0:
        fail(f"Komento epaonnistui ({completed.returncode}): {' '.join(command)}")


def clear_runtime_data(root_dir: Path = ROOT_DIR) -> None:
    patterns = (
        ("user", "*.json"),
        ("data", "*.db"),
        ("data", "*.db-*"),
        ("exports", "*.pdf"),
    )
    for relative_dir, pattern in patterns:
        target_dir = root_dir / relative_dir
        if not target_dir.exists():
            continue
        for path in target_dir.glob(pattern):
            if path.is_file():
                path.unlink()


def venv_python_path(root_dir: Path = ROOT_DIR) -> Path:
    return root_dir / ".venv" / "Scripts" / "python.exe"


def venv_pythonw_path(root_dir: Path = ROOT_DIR) -> Path:
    return root_dir / ".venv" / "Scripts" / "pythonw.exe"


def ensure_supported_python() -> None:
    if is_supported_python():
        return
    fail(
        "Windows-launcher vaatii Python 3.12:n tai 3.11:n. "
        f"Nykyinen versio on {python_version_label()}."
    )


def ensure_venv(root_dir: Path = ROOT_DIR) -> Path:
    venv_python = venv_python_path(root_dir)
    if venv_python.exists():
        version_check = subprocess.run(
            [
                str(venv_python),
                "-c",
                "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)",
            ],
            cwd=root_dir,
        )
        if version_check.returncode == 0:
            return venv_python
        log("Luodaan .venv uudelleen tuetulla Python-versiolla.")

    run_checked([sys.executable, "-m", "venv", ".venv", "--clear"], cwd=root_dir)
    if not venv_python.exists():
        fail("Virtuaaliympariston luonti epaonnistui polkuun .venv\\Scripts\\python.exe.")
    return venv_python


def install_python_requirements(venv_python: Path, root_dir: Path = ROOT_DIR) -> None:
    log("Asennetaan Python-riippuvuudet requirements.txt-tiedostosta.")
    run_checked([str(venv_python), "-m", "pip", "install", "-r", "requirements.txt"], cwd=root_dir)


def build_frontend(root_dir: Path = ROOT_DIR) -> None:
    resolve_executable("npm")
    log("Ajetaan TypeScript-build.")
    run_checked(["npm", "run", "build"], cwd=root_dir)


def verify_frontend_outputs(root_dir: Path = ROOT_DIR) -> None:
    missing = [str(path) for path in REQUIRED_FRONTEND_OUTPUTS if not (root_dir / path).exists()]
    if missing:
        fail("Buildin tulostiedostoja puuttuu: " + ", ".join(missing))


def launch_app(venv_python: Path, *, root_dir: Path = ROOT_DIR, windowed: bool = True) -> int:
    pythonw = venv_pythonw_path(root_dir)
    interpreter = pythonw if windowed and pythonw.exists() else venv_python
    command = [str(interpreter), str(root_dir / "src" / "app" / "app.py")]
    return subprocess.run(command, cwd=root_dir).returncode


def main(*, windowed: bool = True) -> int:
    ensure_supported_python()
    log(f"Kaynnistetaan digi-opo Python-launcherilla (Python {python_version_label()}).")
    clear_runtime_data(ROOT_DIR)
    venv_python = ensure_venv(ROOT_DIR)
    install_python_requirements(venv_python, ROOT_DIR)
    build_frontend(ROOT_DIR)
    verify_frontend_outputs(ROOT_DIR)
    return launch_app(venv_python, root_dir=ROOT_DIR, windowed=windowed)


if __name__ == "__main__":
    raise SystemExit(main(windowed=False))
