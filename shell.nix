let
  flake = builtins.getFlake (toString ./.);
  system = builtins.currentSystem;
in
flake.devShells.${system}.default

# mitäkö tämä tekee taas?