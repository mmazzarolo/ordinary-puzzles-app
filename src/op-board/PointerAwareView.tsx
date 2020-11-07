import React, { FC } from "react";
import { View, Platform, ViewProps, GestureResponderEvent } from "react-native";

const getEventCoordinates = (
  event: GestureResponderEvent
): [number, number] => {
  // On Android and iOS, let's use the native location which are relative
  // to the target view.
  if (Platform.OS === "android" || Platform.OS === "ios") {
    return [event.nativeEvent.locationX, event.nativeEvent.locationY];
  }

  // On the web, touch events coords are relative to the root (still no idea
  // why) so we need to take into account the target view offset.
  // @ts-ignore
  const touch = event?.targetTouches?.[0] || event?.changedTouches?.[0];
  if (touch) {
    // @ts-ignore
    const targetViewCoords = event?.target?.getBoundingClientRect?.();
    event.preventDefault();
    return [
      touch.clientX - targetViewCoords.x,
      touch.clientY - targetViewCoords.y,
    ] as [number, number];
  }

  // On the web (desktop), we can use layerX and layerY which are relative to
  // the target view.
  // @ts-ignore
  return [event?.nativeEvent?.layerX, event?.nativeEvent?.layerY];
};

interface PointerAwareViewProps extends ViewProps {
  onPointerDown: (coords: [number, number]) => void;
  onPointerMove: (coords: [number, number]) => void;
  onPointerUp: (coords: [number, number]) => void;
  pointerEnabled?: boolean;
}

export const PointerAwareView: FC<PointerAwareViewProps> = ({
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  pointerEnabled = false,
  style,
  ...otherProps
}) => {
  const cursorStyle = Platform.select({
    native: {},
    default: {
      cursor: pointerEnabled ? "pointer" : undefined,
    },
  });
  return (
    <View
      pointerEvents={pointerEnabled ? undefined : "none"}
      onTouchStart={(e) => onPointerDown(getEventCoordinates(e))}
      onTouchMove={(e) => onPointerMove(getEventCoordinates(e))}
      onTouchEnd={(e) => onPointerUp(getEventCoordinates(e))}
      // @ts-ignore
      onMouseDown={(e) => onPointerDown(getEventCoordinates(e))}
      // @ts-ignore
      onMouseMove={(e) => onPointerMove(getEventCoordinates(e))}
      // @ts-ignore
      onMouseUp={(e) => onPointerUp(getEventCoordinates(e))}
      // @ts-ignore
      onMouseLeave={(e) => onPointerUp(getEventCoordinates(e))}
      // @ts-ignore
      style={[style, cursorStyle]}
      {...otherProps}
    >
      {children}
    </View>
  );
};
