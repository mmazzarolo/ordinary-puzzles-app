module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [
            ".ios.js",
            ".android.js",
            ".web.js",
            ".js",
            ".ts",
            ".tsx",
            ".json",
          ],
        },
      ],
    ],
  };
};
