const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
app.setAppUserModelId("com.SimonMaks.vibemessenger");

let win;
let tray;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, app.isPackaged ? 'dist/icon.ico' : 'public/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  win.setMenuBarVisibility(false);

  // Загрузка кода (оставляем как было)
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }

  // ВАЖНО: Перехватываем закрытие окна
  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide(); // Вместо закрытия — просто прячем
    }
    return false;
  });
}

// СОЗДАНИЕ ТРЕЯ
app.whenReady().then(() => {
  createWindow();

  // Иконка для трея (нужен файл icon.png в корне или папке assets)
  const iconPath = path.join(__dirname, app.isPackaged ? 'dist/icon.ico' : 'public/icon.ico'); // Или путь к твоей иконке
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Открыть Vibe', click: () => win.show() },
    { type: 'separator' },
    { label: 'Выйти', click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Vibe Messenger');
  tray.setContextMenu(contextMenu);

  // Клик по иконке в трее открывает окно
  tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show();
  });
});