{
  description = "NixOS development environment for digi-opo";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs }:
    let
      lib = nixpkgs.lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pkgs.python312;
          pythonEnv = python.withPackages (ps: with ps; [
            pip
            pywebview
            pyqt6
            pyqt6-webengine
            qtpy
            typing-extensions
          ]);
        in
        {
          default = pkgs.mkShell {
            packages = [
              pythonEnv
              pkgs.nodejs_22
              pkgs.nodePackages.typescript
              pkgs.qt6.qtwayland
            ];

            shellHook = ''
              export QT_QPA_PLATFORM=''${QT_QPA_PLATFORM:-xcb}
              export QT_API=''${QT_API:-pyqt6}
              export QT_PLUGIN_PATH="${pkgs.qt6.qtbase}/lib/qt-6/plugins:${pkgs.qt6.qtdeclarative}/lib/qt-6/plugins:${pkgs.qt6.qtwayland}/lib/qt-6/plugins:${pkgs.qt6.qtwebengine}/lib/qt-6/plugins''${QT_PLUGIN_PATH:+:$QT_PLUGIN_PATH}"
              export QML2_IMPORT_PATH="${pkgs.qt6.qtdeclarative}/lib/qt-6/qml:${pkgs.qt6.qtwebengine}/lib/qt-6/qml''${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
              export QTWEBENGINEPROCESS_PATH="${pkgs.qt6.qtwebengine}/libexec/QtWebEngineProcess"
              echo "digi-opo Nix-shell valmis. Kaynnista: ./run_linux.sh"
            '';
          };
        });

      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          launcher = pkgs.writeShellScript "digi-opo-launcher" ''
            if [ ! -x ./run_linux.sh ]; then
              echo "Suorita nix run repojuuresta, jossa ./run_linux.sh on olemassa." >&2
              exit 1
            fi
            exec ./run_linux.sh "$@"
          '';
        in
        {
          default = {
            type = "app";
            program = "${launcher}";
          };
        });
    };
}
