'use strict';
const game = require('../lib/game');
const { send, handle } = require('../lib/http');

// GET /api/estado?voter=<id>  ->  fase, equipos, cantidad de votos y, si ya cerró, los resultados.
module.exports = handle(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });
  const url = new URL(req.url, 'http://localhost');
  const voter = url.searchParams.get('voter') || '';
  send(res, 200, await game.snapshot({ voter: game.validVoter(voter) ? voter : '' }));
});
