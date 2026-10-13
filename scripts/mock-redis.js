'use strict';
/* Falso Upstash REST para probar el modo Redis sin red: HSETNX, HKEYS, HDEL. */
const http = require('http');
function start() {
  const hash = new Map();
  const run = (c) => {
    const [cmd, , ...a] = c; const U = String(cmd).toUpperCase();
    if (U === 'HSETNX') { if (hash.has(a[0])) return 0; hash.set(a[0], a[1]); return 1; }
    if (U === 'HKEYS') return [...hash.keys()];
    if (U === 'HDEL') { let n = 0; a.forEach((k) => { if (hash.delete(k)) n++; }); return n; }
    throw new Error('ERR unknown command ' + cmd);
  };
  const stats = { calls: 0 };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return res.end('{"error":"unauthorized"}'); }
      const body = JSON.parse(b); res.setHeader('Content-Type', 'application/json');
      stats.calls++;
      try {
        if (req.url === '/pipeline') res.end(JSON.stringify(body.map((c) => ({ result: run(c) }))));
        else res.end(JSON.stringify({ result: run(body) }));
      } catch (e) { res.end(JSON.stringify({ error: e.message })); }
    });
  });
  return new Promise((r) => srv.listen(0, () => r({ srv, stats, url: 'http://127.0.0.1:' + srv.address().port })));
}
module.exports = { start };
