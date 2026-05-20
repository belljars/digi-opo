from __future__ import annotations

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock


def load_launcher_module():
    project_root = Path(__file__).resolve().parents[1]
    launcher_path = project_root / "digi_opo_launcher.py"
    spec = importlib.util.spec_from_file_location("digi_opo_launcher", launcher_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Ei pystynyt lataamaan digi_opo_launcher.py")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class WindowsLauncherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.launcher = load_launcher_module()
        self.temp_dir = Path(tempfile.mkdtemp(prefix="digi-opo-launcher-"))

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_clear_runtime_data_removes_expected_files(self) -> None:
        for relative_path in (
            Path("user") / "quiz_results.json",
            Path("user") / "quiz_sessions.json",
            Path("data") / "tutkinnot.db",
            Path("data") / "tutkinnot.db-wal",
            Path("data") / "tutkinnot.db-shm",
            Path("exports") / "raportti.pdf",
        ):
            target = self.temp_dir / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("test", encoding="utf-8")

        keep_file = self.temp_dir / "data" / "ammatit.json"
        keep_file.parent.mkdir(parents=True, exist_ok=True)
        keep_file.write_text("{}", encoding="utf-8")

        self.launcher.clear_runtime_data(self.temp_dir)

        self.assertFalse((self.temp_dir / "user" / "quiz_results.json").exists())
        self.assertFalse((self.temp_dir / "user" / "quiz_sessions.json").exists())
        self.assertFalse((self.temp_dir / "data" / "tutkinnot.db").exists())
        self.assertFalse((self.temp_dir / "data" / "tutkinnot.db-wal").exists())
        self.assertFalse((self.temp_dir / "data" / "tutkinnot.db-shm").exists())
        self.assertFalse((self.temp_dir / "exports" / "raportti.pdf").exists())
        self.assertTrue(keep_file.exists())

    def test_verify_frontend_outputs_accepts_complete_build(self) -> None:
        for relative_path in self.launcher.REQUIRED_FRONTEND_OUTPUTS:
            target = self.temp_dir / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("// ok", encoding="utf-8")

        self.launcher.verify_frontend_outputs(self.temp_dir)

    def test_verify_frontend_outputs_fails_when_build_output_is_missing(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            self.launcher.verify_frontend_outputs(self.temp_dir)

        self.assertIn("Buildin tulostiedostoja puuttuu", str(ctx.exception))

    def test_resolve_executable_returns_full_path(self) -> None:
        with mock.patch.object(self.launcher.shutil, "which", return_value=r"C:\nodejs\npm.cmd"):
            resolved = self.launcher.resolve_executable("npm")

        self.assertEqual(resolved, r"C:\nodejs\npm.cmd")

    def test_run_checked_uses_resolved_executable(self) -> None:
        with mock.patch.object(
            self.launcher,
            "resolve_executable",
            return_value=r"C:\nodejs\npm.cmd",
        ) as resolve_mock, mock.patch.object(self.launcher.subprocess, "run") as run_mock:
            run_mock.return_value = mock.Mock(returncode=0)

            self.launcher.run_checked(["npm", "run", "build"], cwd=self.temp_dir)

        resolve_mock.assert_called_once_with("npm")
        run_mock.assert_called_once_with(
            [r"C:\nodejs\npm.cmd", "run", "build"],
            cwd=self.temp_dir,
        )


if __name__ == "__main__":
    unittest.main()
