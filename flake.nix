{
  description = "digi-opo development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      pythonEnv = pkgs.python312.withPackages (ps: with ps; [
        pip
        setuptools
        wheel
        pywebview
        pyqt6
        pyqt6-webengine
        qtpy
      ]);
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pythonEnv
          pkgs.nodejs
          pkgs.typescript
        ];
      };
    };
}
