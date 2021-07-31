const { app, BrowserWindow, protocol } = require("electron");

const path = require("path");
const url = require("url");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2880,
    height: 1520,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(
    process.env.ELECTRON_START_URL ||
      url.format({
        pathname: path.join(__dirname, "/../build/index.html"),
        protocol: "file:",
        slashes: true,
      })
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.openDevTools();
}

app.on("ready", () => {
  console.log("heeey");
  protocol.registerHttpProtocol(
    "file",
    (request, callback) => {
      const url = request.url.substr(8);
      console.log("url", url);
      callback({ path: path.normalize(`${__dirname}/${url}`) });
      // if (uri) {
      //   callback({ mimeType: "text/plain", data: Buffer.from(uri) });
      // } else {
      //   callback({ error: -324 }); // EMPTY_RESPONSE
      // }
    },
    (error) => {
      if (error) console.error("Failed to register protocol");
    }
  );
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
