{ pkgs ? import <nixpkgs> {} }:

let
  pythonEnv = pkgs.python312.withPackages (ps: with ps; [
    pip
    setuptools
    wheel
    typing_extensions
    pywebview
    pyqt6
    pyqt6-webengine
    qtpy
  ]);
in
pkgs.mkShell {
  packages = [
    pythonEnv
    pkgs.nodejs
    pkgs.typescript
  ];
}
