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

        # Stable paths to node and pnpm for editors that can't follow /nix/store hashes
        # (e.g. WebStorm on Windows through WSL).
        shellHook = ''
          mkdir -p .direnv/bin
          ln -sfn ${pkgs.nodejs_24}/bin/node   .direnv/bin/node
          ln -sfn ${pkgs.corepack_24}/bin/pnpm .direnv/bin/pnpm
        '';
      };
    };
}
