# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all


def extend_collection(package_name, datas, binaries, hiddenimports):
    package_datas, package_binaries, package_hiddenimports = collect_all(package_name)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hiddenimports


datas = [
    ("src/ui", "src/ui"),
    ("src/data", "src/data"),
]
binaries = []
hiddenimports = [
    "PyQt6.QtPrintSupport",
    "PyQt6.QtWebChannel",
    "PyQt6.QtWebEngineCore",
    "PyQt6.QtWebEngineWidgets",
]

for package_name in ("webview", "PyQt6", "qtpy"):
    extend_collection(package_name, datas, binaries, hiddenimports)


a = Analysis(
    ["src/app/app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="digi-opo",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="digi-opo",
)
