// Local persistence: one save slot plus the mute preference. Storage can throw in private
// windows or when the quota is gone, so every call reports success instead of escaping.

import { SAVE_KEY, MUTE_KEY } from './config.js';

const VERSION = 1;

function storage() {
  try {
    const probe = window.localStorage;
    if (!probe) return null;
    return probe;
  } catch (error) {
    return null;
  }
}

export function hasSave() {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(SAVE_KEY) !== null;
  } catch (error) {
    return false;
  }
}

export function readSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    if (typeof data.money !== 'number' || !data.player || typeof data.player.x !== 'number') return null;
    return data;
  } catch (error) {
    return null;
  }
}

export function writeSave(snapshot) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), ...snapshot }));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch (error) {
    /* nothing useful to do when storage refuses the delete */
  }
}

export function readMuted() {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(MUTE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

export function writeMuted(value) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(MUTE_KEY, value ? '1' : '0');
  } catch (error) {
    /* the mute switch still works for this session */
  }
}

export const SAVE_VERSION = VERSION;
