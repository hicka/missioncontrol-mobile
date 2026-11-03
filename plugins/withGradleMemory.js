// Android builds compile Skia, Reanimated and the Expo modules at once, and with every
// worker busy the build machine ran out of memory ("Gradle build daemon disappeared"),
// each time with R8 shrinking the app while Skia's native code compiled. Two workers still
// let those two meet, so one task runs at a time, and Kotlin compiles inside Gradle rather
// than in a daemon of its own.
const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (c) => {
    const set = (key, value) => {
      c.modResults = c.modResults.filter((p) => !(p.type === "property" && p.key === key));
      c.modResults.push({ type: "property", key, value });
    };
    set("org.gradle.workers.max", "1");
    set("kotlin.compiler.execution.strategy", "in-process");
    return c;
  });
};
