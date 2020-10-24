import React, { FC } from "react";
import { StyleSheet, View, TextStyle, ViewStyle, Animated } from "react-native";
import { observer } from "mobx-react";
import { useColors } from "op-design";
import { Text } from "op-common";
import { Cell } from "./store";

interface Props {
  cell: Cell;
  size: number;
  successAnimValue: Animated.Value;
}

export const calculateFontSize = (size: number) => size * 0.6;

export const calculateBorderWidth = (size: number) => Math.floor(size / 14);

const adjustBorderForOrientation = (cell: Cell, style: ViewStyle) => {
  if (cell.orientation === "horizontal-left") {
    style.borderRightWidth = 0;
  }
  if (cell.orientation === "horizontal-middle") {
    style.borderRightWidth = 0;
    style.borderLeftWidth = 0;
  }
  if (cell.orientation === "horizontal-right") {
    style.borderLeftWidth = 0;
  }
  if (cell.orientation === "vertical-top") {
    style.borderBottomWidth = 0;
  }
  if (cell.orientation === "vertical-middle") {
    style.borderBottomWidth = 0;
    style.borderTopWidth = 0;
  }
  if (cell.orientation === "vertical-bottom") {
    style.borderTopWidth = 0;
  }
};

export const Tile: FC<Props> = observer(function (props) {
  const colors = useColors();
  const { cell, size, successAnimValue } = props;

  // Border width
  const borderWidth = calculateBorderWidth(size);

  // Tile size
  let tileStyle: ViewStyle = {};
  tileStyle.width = size;
  tileStyle.height = size;
  if (cell.col === 0) {
    tileStyle.width = size + borderWidth;
  }
  if (cell.row === 0) {
    tileStyle.height = size + borderWidth;
  }

  // Tile border style
  tileStyle.borderColor = colors.primary[7];
  tileStyle.borderRightWidth = borderWidth;
  tileStyle.borderBottomWidth = borderWidth;
  if (cell.col === 0) {
    tileStyle.borderLeftWidth = borderWidth;
  }
  if (cell.row === 0) {
    tileStyle.borderTopWidth = borderWidth;
  }
  adjustBorderForOrientation(cell, tileStyle);
  // @ts-ignore
  tileStyle.borderColor = successAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.primary[7], colors.primary[9]],
  });

  // Tile background color
  tileStyle.backgroundColor = "transparent";
  if (cell.completed) {
    tileStyle.backgroundColor = colors.primary[3];
  } else if (cell.orientation !== "none") {
    tileStyle.backgroundColor = colors.primary[5];
  }

  // Content color (shouldn't be needed, but declaring it here fixes some a
  // couple of white gaps on Android)
  const contentStyle: ViewStyle = {};
  if (cell.completed) {
    contentStyle.backgroundColor = colors.primary[3];
  } else if (cell.orientation !== "none") {
    contentStyle.backgroundColor = colors.primary[5];
  }

  // Content border
  if (cell.orientation !== "none") {
    contentStyle.borderColor = colors.primary[1];
    contentStyle.borderTopWidth = borderWidth;
    contentStyle.borderRightWidth = borderWidth;
    contentStyle.borderBottomWidth = borderWidth;
    contentStyle.borderLeftWidth = borderWidth;
  }
  adjustBorderForOrientation(cell, contentStyle);

  // Content position
  contentStyle.top = -borderWidth;
  contentStyle.left = -borderWidth;
  contentStyle.right = -borderWidth;
  contentStyle.bottom = -borderWidth;

  // Text style
  const textStyle: TextStyle = {};
  if (cell.value === "." && cell.orientation === "none") {
    textStyle.color = colors.primary[0];
  } else {
    textStyle.color = "#fff";
  }
  textStyle.fontSize = calculateFontSize(size);
  textStyle.paddingRight = borderWidth / 2;
  textStyle.paddingBottom = borderWidth;
  if (cell.col === 0) {
    textStyle.paddingRight = 0;
  }
  if (cell.row === 0) {
    textStyle.paddingBottom = 0;
  }

  // Hover style
  const hoverStyle: ViewStyle = {};
  hoverStyle.backgroundColor = colors.primary[9];

  // Symbol
  const symbol = cell.value === "." ? "•" : cell.value;

  return (
    <Animated.View style={[styles.root, tileStyle]} pointerEvents="none">
      <View style={[styles.content, contentStyle]} />
      <Text
        family="secondary"
        weight="semibold"
        style={[styles.text, textStyle]}
      >
        {symbol}
      </Text>
      {cell.highlighted && <View style={[styles.hover, hoverStyle]} />}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    position: "absolute",
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    userSelect: "none", // react-native-web
  },
  content: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  hover: {
    position: "absolute",
    opacity: 0.5,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
