{
  description = "Ubald.dev";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShell {
        name = "Ubald.dev";
        packages = with pkgs; [
          # Node 24, the version the site builds with (locally and in CI).
          nodejs_24
          # corepack provides the exact pnpm pinned by package.json's "packageManager".
          corepack_24
        ];

        # Keep corepack from prompting before it downloads the pinned pnpm.
        COREPACK_ENABLE_DOWNLOAD_PROMPT = "0";
      };
    };
}
