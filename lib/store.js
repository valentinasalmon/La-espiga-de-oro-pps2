'use strict';
/*
 * Almacenamiento mínimo: guarda "marcas" (archivos vacíos) cuyo nombre lleva el dato.
 *   teams/<id>__<nombre en base64url>
 *   votes/<votante>__<id del equipo>
 *   config/phase__<fase>
 * Orden de preferencia: Redis (Upstash, por REST) > Vercel Blob > carpeta local .data (solo en tu compu).
 * Con Redis las marcas son campos de un único hash, y crear una marca es atómico (HSETNX).
 */
const fs = require('fs');
const path = require('path');

// Con @vercel/blob 2.x alcanza con BLOB_STORE_ID (autenticación automática en Vercel) o con el token.
const HAS_BLOB = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(__dirname, '..', '.data');

/* ---------- Redis (Upstash REST) ---------- */
const HASH = 'espiga:marcas';
function redisConf() {
  for (const k of Object.keys(process.env)) {
    if (/(^|_)(UPSTASH_REDIS_REST_URL|KV_REST_API_URL|REST_API_URL)$/.test(k) && process.env[k]) {
      const tokenKey = k.replace(/URL$/, 'TOKEN');
      if (process.env[tokenKey]) return { url: process.env[k].replace(/\/+$/, ''), token: process.env[tokenKey] };
    }
  }
  return null;
}
/* Redis clásico por TCP (variable REDIS_URL, p. ej. el Redis de la integración de Vercel). */
const tcpUrl = () => process.env.REDIS_URL || '';
let tcp = null;
async function tcpClient() {
  if (tcp && tcp.isOpen) return tcp;
  const { createClient } = require('redis');
  const c = createClient({ url: tcpUrl(), socket: { connectTimeout: 6000, reconnectStrategy: false } });
  c.on('error', () => { if (tcp === c) tcp = null; });
  await c.connect();
  tcp = c;
  return c;
}
async function redisTcp(commands) {
  try {
    const c = await tcpClient();
    const out = [];
    for (const cmd of commands) out.push(await c.sendCommand(cmd.map(String)));
    return out;
  } catch (e) {
    tcp = null;
    throw new Error('Redis: ' + (e && e.message ? e.message : e));
  }
}
async function redis(...commands) {
  if (!redisConf()) { const r = await redisTcp(commands); return commands.length > 1 ? r : r[0]; }
  const c = redisConf();
  const pipeline = commands.length > 1;
  const r = await fetch(c.url + (pipeline ? '/pipeline' : ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline ? commands : commands[0]),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Redis: ' + (j.error || r.status));
  const items = pipeline ? j : [j];
  items.forEach((x) => { if (x && x.error) throw new Error('Redis: ' + x.error); });
  return pipeline ? items.map((x) => x.result) : items[0].result;
}
async function redisKeys(prefix) {
  const keys = (await redis(['HKEYS', HASH])) || [];
  return keys.filter((k) => k.startsWith(prefix));
}
async function redisDel(keys) {
  for (let i = 0; i < keys.length; i += 200) await redis(['HDEL', HASH].concat(keys.slice(i, i + 200)));
  return keys.length;
}

function mode() {
  if (redisConf() || tcpUrl()) return 'redis';
  if (HAS_BLOB()) return 'blob';
  if (process.env.VERCEL) return 'missing';
  return 'local';
}

function assertReady() {
  if (mode() === 'missing') {
    const e = new Error('Falta conectar la base de datos (Redis) al proyecto de Vercel.');
    e.code = 'NO_STORAGE';
    throw e;
  }
}

/* ---------- Vercel Blob ---------- */
async function blobList(prefix) {
  const { list } = await import('@vercel/blob');
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    for (const b of r.blobs) out.push({ pathname: b.pathname, url: b.url });
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

/* ---------- Carpeta local ---------- */
function walk(dir, base, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) walk(full, rel, acc);
    else acc.push({ pathname: rel, url: full });
  }
  return acc;
}

/** Devuelve los nombres que empiezan con el prefijo, ordenados. */
async function list(prefix) {
  assertReady();
  if (mode() === 'redis') return (await redisKeys(prefix)).sort();
  const all = mode() === 'blob' ? await blobList(prefix) : walk(LOCAL_DIR, '', []).filter((b) => b.pathname.startsWith(prefix));
  return all.map((b) => b.pathname).sort();
}

/** Crea una marca. Devuelve false si ya existía. */
async function create(pathname) {
  assertReady();
  if (mode() === 'redis') return (await redis(['HSETNX', HASH, pathname, '1'])) === 1;
  if (mode() === 'blob') {
    const { put } = await import('@vercel/blob');
    try {
      await put(pathname, '1', {
        access: 'public',
        contentType: 'text/plain',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return true;
    } catch (err) {
      if (/already exists/i.test(String(err && err.message))) return false;
      throw err;
    }
  }
  const full = path.join(LOCAL_DIR, pathname);
  if (fs.existsSync(full)) return false;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '1');
  return true;
}

/** Borra todas las marcas que empiezan con el prefijo. Devuelve cuántas borró. */
async function removePrefix(prefix) {
  assertReady();
  if (mode() === 'redis') return redisDel(await redisKeys(prefix));
  if (mode() === 'blob') {
    const { del } = await import('@vercel/blob');
    const items = await blobList(prefix);
    if (items.length) await del(items.map((i) => i.url));
    return items.length;
  }
  const items = walk(LOCAL_DIR, '', []).filter((b) => b.pathname.startsWith(prefix));
  items.forEach((i) => fs.unlinkSync(i.url));
  return items.length;
}

/** Borra las marcas con ese prefijo cuyo nombre cumple la condición. */
async function removeWhere(prefix, predicate) {
  assertReady();
  if (mode() === 'redis') return redisDel((await redisKeys(prefix)).filter(predicate));
  if (mode() === 'blob') {
    const { del } = await import('@vercel/blob');
    const items = (await blobList(prefix)).filter((i) => predicate(i.pathname));
    if (items.length) await del(items.map((i) => i.url));
    return items.length;
  }
  const items = walk(LOCAL_DIR, '', []).filter((b) => b.pathname.startsWith(prefix) && predicate(b.pathname));
  items.forEach((i) => fs.unlinkSync(i.url));
  return items.length;
}

module.exports = { list, create, removePrefix, removeWhere, mode };
