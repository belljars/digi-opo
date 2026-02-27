{
  description = "digi-opo development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pythonEnv = pkgs.python3.withPackages (ps: with ps; [
          pywebview
          pyqt6
          ps."pyqt6-webengine"
          qtpy
        ]);
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20
            pythonEnv
            sqlite
          ];

          shellHook = ''
            export PYTHONUNBUFFERED=1

            echo "digi-opo dev shell"
            echo "Build frontend: npm run build"
            echo "Run app:        python3 src/app/app.py"
          '';
        };
      });
}
