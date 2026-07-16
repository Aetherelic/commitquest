{
  description = "CommitQuest — a local-first developer RPG";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      packageFor = system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
          pkgs.buildNpmPackage {
            pname = "commitquest";
            version = "1.1.1";
            src = self;

            nodejs = pkgs.nodejs_24;
            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;
            npmBuildScript = "build";

            nativeBuildInputs = [ pkgs.makeWrapper ];
            nativeCheckInputs = [ pkgs.git ];
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              npm test
              runHook postCheck
            '';

            postInstall = ''
              cli="$out/lib/node_modules/commitquest/dist/cli.js"
              test -f "$cli"

              rm -f "$out/bin/cq" "$out/bin/commitquest"
              makeWrapper ${pkgs.nodejs_24}/bin/node "$out/bin/cq" \
                --add-flags "$cli" \
                --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
              ln -s cq "$out/bin/commitquest"

              mkdir -p \
                "$out/share/bash-completion/completions" \
                "$out/share/zsh/site-functions" \
                "$out/share/fish/vendor_completions.d" \
                "$out/share/man/man1"

              "$out/bin/cq" completion bash > "$out/share/bash-completion/completions/cq"
              "$out/bin/cq" completion zsh > "$out/share/zsh/site-functions/_cq"
              "$out/bin/cq" completion fish > "$out/share/fish/vendor_completions.d/cq.fish"
              cp docs/commitquest.1 "$out/share/man/man1/commitquest.1"
              ln -s commitquest.1 "$out/share/man/man1/cq.1"
            '';

            meta = {
              description = "A local-first developer RPG that turns Git activity into quests, XP, achievements, and campaigns";
              homepage = "https://github.com/Aetherelic/commitquest";
              license = pkgs.lib.licenses.mit;
              mainProgram = "cq";
              platforms = pkgs.lib.platforms.linux;
            };
          };
    in {
      packages = forAllSystems (system:
        let package = packageFor system;
        in {
          default = package;
          commitquest = package;
        });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/cq";
          meta.description = "Launch CommitQuest";
        };
      });

      checks = forAllSystems (system: {
        package = self.packages.${system}.default;
      });

      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [ nodejs_24 git ];
          };
        });
    };
}
