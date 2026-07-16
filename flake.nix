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
            version = "0.5.0";
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
              wrapProgram "$out/bin/cq" \
                --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
              wrapProgram "$out/bin/commitquest" \
                --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
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
