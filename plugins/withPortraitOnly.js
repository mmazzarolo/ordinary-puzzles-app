const { withInfoPlist } = require("expo/config-plugins");

const portraitOnly = ["UIInterfaceOrientationPortrait"];

module.exports = function withPortraitOnly(config) {
  return withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults.UIRequiresFullScreen = true;
    infoPlistConfig.modResults.UISupportedInterfaceOrientations = portraitOnly;
    infoPlistConfig.modResults["UISupportedInterfaceOrientations~ipad"] =
      portraitOnly;
    return infoPlistConfig;
  });
};
