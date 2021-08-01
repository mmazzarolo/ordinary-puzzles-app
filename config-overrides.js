const webpack = require("webpack");
const { override, addWebpackPlugin } = require("customize-cra");

// Rename the CRA entry point to avoid confustion between it and the native one.
const paths = require("react-scripts/config/paths");
paths.appIndexJs = `${paths.appSrc}/index.web.ts`;

module.exports = override(
  addWebpackPlugin(
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
      __DEV__: process.env.NODE_ENV !== "production",
      __ELECTRON__: !!process.env.ELECTRON,
    })
  )
);
