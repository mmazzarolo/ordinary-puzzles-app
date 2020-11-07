const webpack = require("webpack");
const { override, addWebpackPlugin } = require("customize-cra");

module.exports = override(
  addWebpackPlugin(
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
      __DEV__: process.env.NODE_ENV !== "production",
    })
  )
);
