from __future__ import annotations

import os
from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if sys.platform.startswith("linux"):
    os.environ.setdefault("QT_API", "pyqt6")

if sys.platform.startswith("linux") and os.environ.get("WAYLAND_DISPLAY"):
    os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

import rajapinta as interface
import paths as path
import webview

def _project_root() -> Path:
    if getattr(sys, "frozen", False):
        bundled_root = getattr(sys, "_MEIPASS", None)
        if bundled_root:
            return Path(bundled_root).resolve()
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def _project_paths() -> path.ProjectPaths:
    project_root = _project_root()
    if getattr(sys, "frozen", False):
        return path.ProjectPaths.for_runtime(project_root)
    return path.ProjectPaths(project_root)


class Api(interface.Api):
    '''Käyttöliittymän API-luokka, joka perii backendin API:n ja tarjoaa käyttöliittymään liittyviä toimintoja'''
    def __init__(self, paths: path.ProjectPaths | None = None) -> None:
        # Alustaa backendin projektin juuren pohjalta
        super().__init__(paths or _project_paths())


def main() -> None:
    '''Sovelluksen pääfunktio, joka käynnistää käyttöliittymän ja paikallisen palvelimen'''
    paths = _project_paths()
    if getattr(sys, "frozen", False):
        path.clear_user_data_root(paths.user_data_root)
    api = Api(paths)
    server, port = path.start_static_server(paths)
    try:
        window = webview.create_window(
            "digi-opo",
            f"http://127.0.0.1:{port}{paths.ui_index_path()}",
            js_api=api,
            width=1024,
            height=768,
        )
        if window is not None:
            api.set_window(window)
        webview.start(gui="qt")
    finally:
        server.shutdown()
        server.server_close()
        api.close()


if __name__ == "__main__":
    main()
