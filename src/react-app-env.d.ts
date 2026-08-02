declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.wav" {
  const value: number;
  export default value;
}

// Minimal typing for Node's crypto builtin, used only by Jest tests (the app
// tsconfig deliberately carries no full Node types).
declare module "crypto" {
  export function createHash(algorithm: string): {
    update(
      data: string,
      encoding: string,
    ): { digest(encoding: string): string };
  };
}
