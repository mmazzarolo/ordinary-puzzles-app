import { metrics } from "op-design";
import React, { FC } from "react";
import { StyleSheet, Platform, View } from "react-native";

// Centers the layout horizontally on the web, clamping it to "webMaxLayoutWidth"
export const Layout: FC = function ({ children }) {
  return Platform.select({
    native: <>children</>,
    default: <View style={styles.root}>{children}</View>,
  });
};

const styles = StyleSheet.create({
  root: {
    height: "100%",
    width: "100%",
    maxWidth: metrics.webMaxLayoutWidth,
    alignSelf: "center",
  },
});
