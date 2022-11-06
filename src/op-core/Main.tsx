import { skipSplashScreen } from "op-config";
import { colors, metrics, useColors } from "op-design";
import { Splash } from "op-splash";
import React, { FC, useState } from "react";
import { StyleSheet, SafeAreaView, View } from "react-native";
import { Layout } from "./Layout";
import { Router } from "./Router";

interface Props {
  areFontsLoaded: boolean;
}

export const Main: FC<Props> = function ({ areFontsLoaded }) {
  const colors = useColors();
  const [isShowingSplash, setIsShowingSplash] = useState(!skipSplashScreen);
  const hideSplash = () => {
    setIsShowingSplash(false);
  };

  if (!areFontsLoaded) return <View style={styles.preSplash} />;

  if (isShowingSplash) return <Splash onHide={hideSplash} />;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.primary[9] }]}>
      <Layout>
        <Router />
      </Layout>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    height: "100%",
    width: "100%",
    flex: 1,
  },
  preSplash: {
    padding: metrics.screenMargin,
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    backgroundColor: colors.splash,
  },
});
