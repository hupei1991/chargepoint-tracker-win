'use strict';
// Dev-only helper: when CP_SCREENSHOT=<dir> is set (together with CP_MOCK=1),
// walk through a few states and save PNGs of the window. Used for README images.
const fs = require('fs');
const path = require('path');

module.exports = (win, tracker, doAction, setLang) => {
  const dir = process.env.CP_SCREENSHOT;
  fs.mkdirSync(dir, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => fs.writeFileSync(path.join(dir, `${name}.png`), (await win.webContents.capturePage()).toPNG());

  win.webContents.once('did-finish-load', async () => {
    win.show();
    await wait(600); await shot('empty');
    tracker.configure({ deviceId: '100000', port: 2 });
    await tracker.fetchOnce();
    await win.webContents.executeJavaScript('document.activeElement && document.activeElement.blur()');
    for (const l of ['en', 'zh']) {
      setLang(l);
      doAction('stop');
      require('./mock').reset();
      await wait(1000); await shot(`${l}-idle`);
      doAction('start');
      await wait(800); await shot(`${l}-watching`);
      await tracker.tick();
      await wait(500); await shot(`${l}-free`);
    }
    require('electron').app.exit(0);
  });
};
