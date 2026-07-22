import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseStoredJson } from "./puzzleHistory";

const storageItemKeys = ["completedPuzzles", "playedPuzzles"] as const;

type ElementType<T extends readonly unknown[]> =
  T extends readonly (infer ElementType)[] ? ElementType : never;

type StorageItemKey = ElementType<typeof storageItemKeys>;

export const clearStorage = async () => {
  await Promise.all(storageItemKeys.map((key) => AsyncStorage.removeItem(key)));
};

export const rehydrateObject = async (key: StorageItemKey) => {
  const serializedItem = await AsyncStorage.getItem(key);
  return parseStoredJson(serializedItem);
};

export const persistObject = async (key: StorageItemKey, value: object) => {
  const serializedItem = JSON.stringify(value);
  await AsyncStorage.setItem(key, serializedItem);
};
