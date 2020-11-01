import AsyncStorage from "@react-native-community/async-storage";

const storageItemKeys = ["completedPuzzles", "playedPuzzles"] as const;

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never;

type StorageItemKey = ElementType<typeof storageItemKeys>;

export const clearStorage = async () => {
  await Promise.all(storageItemKeys.map((key) => AsyncStorage.removeItem(key)));
};

export const rehydrateObject = async (key: StorageItemKey) => {
  const serializedItem = await AsyncStorage.getItem(key);
  const item = serializedItem ? JSON.parse(serializedItem) : undefined;
  return item;
};

export const persistObject = async (key: StorageItemKey, value: Object) => {
  const serializedItem = JSON.stringify(value);
  await AsyncStorage.setItem(key, serializedItem);
};
