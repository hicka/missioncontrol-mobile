// Android builds compile Skia, Reanimated and the Expo modules at once, and with every
// worker busy the build machine ran out of memory twice ("Gradle build daemon disappeared").
// Two workers, and Kotlin compiled inside Gradle rather than in a daemon of its own.
const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (c) => {
    const set = (key, value) => {
      c.modResults = c.modResults.filter((p) => !(p.type === "property" && p.key === key));
      c.modResults.push({ type: "property", key, value });
    };
    set("org.gradle.workers.max", "2");
    set("kotlin.compiler.execution.strategy", "in-process");
    return c;
  });
};
