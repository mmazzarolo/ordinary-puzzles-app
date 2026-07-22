export const registerServiceWorker = () => {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    window.location.protocol === "file:" ||
    process.env.EXPO_PUBLIC_ELECTRON === "1"
  ) {
    return;
  }

  const register = () => {
    const serviceWorkerUrl = new URL("service-worker.js", window.location.href);
    void navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn("Failed to register service worker", error);
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
};
