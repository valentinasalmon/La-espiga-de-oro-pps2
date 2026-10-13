'use strict';
const game = require('../lib/game');
const { send, handle } = require('../lib/http');

// GET /api/estado?voter=<id>  ->  fase, equipos, cantidad de votos y, si ya cerró, los resultados.
module.exports = handle(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });
  const url = new URL(req.url, 'http://localhost');
  const voter = url.searchParams.get('voter') || '';
  const ok = game.validVoter(voter);
  // Sin votante la respuesta es igual para todos: se comparte 2 segundos para no saturar la base de datos.
  send(res, 200, await game.snapshot({ voter: ok ? voter : '' }), ok ? 'no-store' : 'public, s-maxage=2, stale-while-revalidate=4');
});
