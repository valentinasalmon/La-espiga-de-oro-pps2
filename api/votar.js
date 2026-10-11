'use strict';
const game = require('../lib/game');
const store = require('../lib/store');
const { send, readBody, handle } = require('../lib/http');

// POST /api/votar  { voter, team }  ->  un solo voto por celular, solo con la votación abierta.
module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
  const body = await readBody(req);
  const voter = body.voter;
  const team = String(body.team || '');
  if (!game.validVoter(voter)) return send(res, 400, { error: 'No se pudo identificar este celular. Recargá la página.' });

  const phase = await game.getPhase();
  if (phase !== 'votacion') {
    return send(res, 403, { error: phase === 'cerrada' ? 'La votación ya cerró.' : 'La votación todavía no abrió.', phase });
  }
  const [teams, votes] = await Promise.all([game.getTeams(), game.getVotes()]);
  if (!teams.some((t) => t.id === team)) return send(res, 404, { error: 'Ese equipo no existe.' });

  const prev = votes.find((v) => v.voter === voter);
  if (prev) return send(res, 409, { error: 'Ya votaste desde este celular.', myVote: prev.team });
  if (votes.length >= game.MAX_VOTES) return send(res, 403, { error: 'Se llegó al máximo de votos.' });

  const created = await store.create('votes/' + voter + '__' + team);
  if (!created) return send(res, 409, { error: 'Ya votaste desde este celular.' });
  send(res, 200, { ok: true, myVote: team });
});
