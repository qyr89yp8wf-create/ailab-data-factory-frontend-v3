import { nowDateTime } from './timeUtils';

const PREFIX = 'data-factory-frontend-v3:';

export const wait = (ms = 120) => new Promise(resolve => window.setTimeout(resolve, ms));
export const clone = value => value == null ? value : structuredClone(value);

export function now() {
  return nowDateTime();
}

export function id(prefix = 'MOCK') {
  const date = new Date();
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
  return `${prefix}-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

export function writeStore(key, value) {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn(`Mock 状态保存失败：${key}`, error);
  }
  return clone(value);
}

export function updateStore(key, fallback, updater) {
  const current = readStore(key, fallback);
  const next = updater(clone(current));
  return writeStore(key, next);
}

const seedCache = new Map();

export async function loadSeed(name) {
  if (!seedCache.has(name)) {
    seedCache.set(name, fetch(`${import.meta.env.BASE_URL}mock-data/${name}`).then(response => {
      if (!response.ok) throw new Error(`Mock 样例读取失败：${name}`);
      return response.json();
    }));
  }
  return clone(await seedCache.get(name));
}

export function textDataUrl(text, type = 'text/plain;charset=utf-8') {
  return `data:${type},${encodeURIComponent(text)}`;
}

export function jsonDataUrl(value) {
  return textDataUrl(JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
}

export function csvDataUrl(rows = []) {
  const data = rows.length ? rows : [
    ['id', 'type', 'quality_score'],
    ['MOCK-0001', 'synthetic', '96.8'],
    ['MOCK-0002', 'synthetic', '94.5'],
  ];
  return textDataUrl(`\ufeff${data.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')}`, 'text/csv;charset=utf-8');
}

export async function mockResult(value, ms = 120) {
  await wait(ms);
  return clone(value);
}
