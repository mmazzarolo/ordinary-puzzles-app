import { GestureResponderEvent, Platform } from "react-native";

// Update a web touch/click event adding the locationX/locationY values
// that we're using in the app to detect the location of the tile in the board
export const nativifyGestureResponderEvent = (
  event: GestureResponderEvent
): GestureResponderEvent => {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    event.nativeEvent.locationX =
      // @ts-ignore
      event?.targetTouches?.[0]?.clientX || event?.nativeEvent?.layerX;
    event.nativeEvent.locationY =
      // @ts-ignore
      event?.targetTouches?.[0]?.clientY || event?.nativeEvent?.layerY;
  }
  return event;
};
