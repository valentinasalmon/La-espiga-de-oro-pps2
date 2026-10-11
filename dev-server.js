'use strict';
/* Servidor local para probar todo sin Vercel:  npm run dev  ->  http://localhost:3000 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
};
const API = {
  '/api/estado': require('./api/estado'),
  '/api/equipos': require('./api/equipos'),
  '/api/votar': require('./api/votar'),
  '/api/admin': require('./api/admin'),
};

function serveStatic(urlPath, res) {
  let rel = decodeURIComponent(urlPath.split('?')[0]).replace(/\.\.+/g, '');
  let file = path.join(PUBLIC, rel);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('No encontrado'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (API[pathname]) return API[pathname](req, res);
  serveStatic(pathname, res);
});

if (require.main === module) {
  server.listen(PORT, () => console.log('La Espiga de Oro en http://localhost:' + PORT + '  (PIN de prueba: 1234)'));
}
module.exports = server;
