import { Appearance, useColorScheme } from "react-native";
import tinycolor from "tinycolor2";

const primaryColor = "#171520";
const splashColor = "#84818D";

const palette = new Array(10).fill(primaryColor).map((color, index) =>
  tinycolor(color)
    .brighten(index * 10)
    .toString()
);
const lightColors = palette;
const darkColors = palette.slice().reverse();

export const colors = {
  primary: Appearance.getColorScheme() === "dark" ? darkColors : lightColors,
  splash: splashColor,
};

export const useColors = function () {
  const colorScheme = useColorScheme();
  return {
    primary: colorScheme === "dark" ? darkColors : lightColors,
    splash: splashColor,
  };
};
