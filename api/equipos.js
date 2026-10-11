'use strict';
const game = require('../lib/game');
const store = require('../lib/store');
const { send, readBody, handle } = require('../lib/http');

// POST /api/equipos  { name }  ->  inscribe un equipo (solo mientras la inscripción está abierta).
module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
  const body = await readBody(req);
  const name = game.cleanName(body.name);
  if (name.length < 2 || name.length > 30) {
    return send(res, 400, { error: 'El nombre del equipo debe tener entre 2 y 30 caracteres.' });
  }
  if ((await game.getPhase()) !== 'inscripcion') {
    return send(res, 403, { error: 'La inscripción está cerrada.' });
  }
  const teams = await game.getTeams();
  if (teams.length >= game.MAX_TEAMS) {
    return send(res, 403, { error: 'Se llegó al máximo de equipos.' });
  }
  const key = name.toLocaleLowerCase('es');
  if (teams.some((t) => t.name.toLocaleLowerCase('es') === key)) {
    return send(res, 409, { error: 'Ya hay un equipo con ese nombre. Elijan otro.' });
  }
  const id = game.newId();
  await store.create('teams/' + id + '__' + game.b64(name));
  send(res, 201, { team: { id, name } });
});
