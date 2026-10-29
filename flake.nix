{
  description = "JobTracker offline AWS coursework and smoke tools; no deployment shell hook";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  outputs = { nixpkgs, ... }:
    let systems = [ "x86_64-linux" "aarch64-linux" ];
    in {
      devShells = nixpkgs.lib.genAttrs systems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = [ pkgs.git pkgs.nodejs_22 pkgs.pnpm pkgs.awscli2 pkgs.cfn-lint
              (pkgs.python3.withPackages (p: [ p.pytest p.boto3 ])) ];
          };
        });
    };
}
