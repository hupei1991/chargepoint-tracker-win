'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cp', {
  get: () => ipcRenderer.invoke('get'),
  action: (a) => ipcRenderer.invoke('action', a),
  refresh: () => ipcRenderer.invoke('refresh'),
  setStation: (id) => ipcRenderer.invoke('setStation', id),
  setPort: (n) => ipcRenderer.invoke('setPort', n),
  setInterval: (s) => ipcRenderer.invoke('setInterval', s),
  setLogin: (on) => ipcRenderer.invoke('setLogin', on),
  setLang: (pref) => ipcRenderer.invoke('setLang', pref),
  openWeb: () => ipcRenderer.invoke('openWeb'),
  hide: () => ipcRenderer.invoke('hide'),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, s) => fn(s)),
  onToast: (fn) => ipcRenderer.on('toast', (_e, m) => fn(m)),
  onLang: (fn) => ipcRenderer.on('lang', (_e, l) => fn(l)),
});
