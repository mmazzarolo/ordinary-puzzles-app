const { withGradleProperties } = require("expo/config-plugins");

const gradleJvmArgs = "-Xmx4g -XX:MaxMetaspaceSize=1g";

module.exports = function withGradleJvmMemory(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const existingProperty = gradleConfig.modResults.find(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs",
    );

    if (existingProperty) {
      existingProperty.value = gradleJvmArgs;
    } else {
      gradleConfig.modResults.push({
        type: "property",
        key: "org.gradle.jvmargs",
        value: gradleJvmArgs,
      });
    }

    return gradleConfig;
  });
};
