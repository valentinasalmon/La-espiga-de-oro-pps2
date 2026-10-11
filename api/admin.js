'use strict';
const game = require('../lib/game');
const store = require('../lib/store');
const { send, readBody, handle } = require('../lib/http');

// POST /api/admin  { pin, action, value?, team? }
//   action: "check" | "phase" (value: inscripcion | votacion | cerrada) | "removeTeam" (team) | "reset"
module.exports = handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
  const body = await readBody(req);

  const pin = game.pinCheck(body.pin);
  if (pin.missing) return send(res, 503, { error: 'Falta configurar la variable ADMIN_PIN en Vercel.' });
  if (!pin.ok) return send(res, 401, { error: 'PIN incorrecto.' });

  switch (body.action) {
    case 'check':
      break;
    case 'phase':
      if (!game.PHASES.includes(body.value)) return send(res, 400, { error: 'Fase inválida.' });
      await game.setPhase(body.value);
      break;
    case 'removeTeam': {
      const id = String(body.team || '');
      if (!/^[a-z0-9]+$/.test(id)) return send(res, 400, { error: 'Equipo inválido.' });
      await store.removePrefix('teams/' + id + '__');
      await store.removeWhere('votes/', (p) => p.endsWith('__' + id));
      break;
    }
    case 'reset':
      await store.removePrefix('teams/');
      await store.removePrefix('votes/');
      await store.removePrefix('config/');
      break;
    default:
      return send(res, 400, { error: 'Acción inválida.' });
  }
  send(res, 200, await game.snapshot({ admin: true }));
});
