const { app, BrowserWindow } = require("electron");
const path = require("path");
const url = require("url");

let mainWindow;

const startUrl = process.argv.find((argument) => /^https?:\/\//.test(argument));
const isDev = !!startUrl;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(
    startUrl ||
      url.format({
        pathname: path.join(__dirname, "../dist-web/index.html"),
        protocol: "file:",
        slashes: true,
      }),
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  createWindow();
});

// Quit when all windows are closed, except on macOS, where it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
