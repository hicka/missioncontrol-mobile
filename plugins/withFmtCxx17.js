// React Native 0.76 ships fmt 11.0.2, whose consteval format strings newer
// Xcode clang rejects ("call to consteval function ... is not a constant
// expression"). Compiled as C++17 the library never takes that path, so the
// app builds with any Xcode, local or on EAS.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const MARK = "# fmt as C++17 (withFmtCxx17)";
const PATCH = `
    ${MARK}
    installer.pods_project.targets.each do |t|
      next unless t.name == 'fmt'
      t.build_configurations.each { |c| c.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17' }
    end
`;

module.exports = function withFmtCxx17(config) {
  return withDangerousMod(config, ["ios", async (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
    let text = fs.readFileSync(file, "utf8");
    if (!text.includes(MARK)) {
      // after React Native's own hook, which sets every pod to C++20
      text = text.replace(/(\n[ \t]*react_native_post_install\([\s\S]*?\n[ \t]*\)\n)/, `$1${PATCH}`);
      fs.writeFileSync(file, text);
    }
    return cfg;
  }]);
};
