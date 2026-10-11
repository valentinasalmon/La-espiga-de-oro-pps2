'use strict';
/*
 * Almacenamiento mínimo: guarda "marcas" (archivos vacíos) cuyo nombre lleva el dato.
 *   teams/<id>__<nombre en base64url>
 *   votes/<votante>__<id del equipo>
 *   config/phase__<fase>
 * En Vercel usa Vercel Blob. En tu compu, sin token, usa la carpeta .data.
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.join(__dirname, '..', '.data');

function mode() {
  if (TOKEN) return 'blob';
  if (process.env.VERCEL) return 'missing';
  return 'local';
}

function assertReady() {
  if (mode() === 'missing') {
    const e = new Error('Falta conectar el almacenamiento Blob al proyecto de Vercel.');
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
  const all = mode() === 'blob' ? await blobList(prefix) : walk(LOCAL_DIR, '', []).filter((b) => b.pathname.startsWith(prefix));
  return all.map((b) => b.pathname).sort();
}

/** Crea una marca. Devuelve false si ya existía. */
async function create(pathname) {
  assertReady();
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
