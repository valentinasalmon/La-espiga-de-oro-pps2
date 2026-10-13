'use strict';
/* Prueba de punta a punta de la API contra el servidor local (usa la carpeta .data). */
const assert = require('assert');

if (process.env.ADMIN_PIN === undefined) process.env.ADMIN_PIN = '';
const server = require('../dev-server');

async function call(base, method, url, body) {
  const r = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json() };
}

(async () => {
  const live = server.listen(0);
  const base = 'http://localhost:' + live.address().port;
  const admin = (action, extra) => call(base, 'POST', '/api/admin', Object.assign({ pin: '1234', action }, extra));
  try {
    await admin('reset');

    let r = await call(base, 'GET', '/api/estado');
    assert.strictEqual(r.json.phase, 'inscripcion');
    assert.deepStrictEqual(r.json.teams, []);

    // inscripción
    r = await call(base, 'POST', '/api/equipos', { name: '  Los Panaderos  ' });
    assert.strictEqual(r.status, 201); const t1 = r.json.team;
    assert.strictEqual(t1.name, 'Los Panaderos');
    r = await call(base, 'POST', '/api/equipos', { name: 'Ñandú Código' });
    assert.strictEqual(r.status, 201); const t2 = r.json.team;
    assert.strictEqual(t2.name, 'Ñandú Código');
    r = await call(base, 'POST', '/api/equipos', { name: 'los panaderos' });
    assert.strictEqual(r.status, 409);
    r = await call(base, 'POST', '/api/equipos', { name: 'a' });
    assert.strictEqual(r.status, 400);
    r = await call(base, 'POST', '/api/equipos', { name: 'Tercero <b>' });
    assert.strictEqual(r.status, 201); const t3 = r.json.team;
    assert.ok(!/[<>]/.test(t3.name));

    // todavía no se puede votar
    r = await call(base, 'POST', '/api/votar', { voter: 'abcdefgh1', team: t1.id });
    assert.strictEqual(r.status, 403);

    // PIN
    r = await call(base, 'POST', '/api/admin', { pin: 'mal', action: 'check' });
    assert.strictEqual(r.status, 401);

    // abrir votación
    r = await admin('phase', { value: 'votacion' });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.json.phase, 'votacion');
    r = await call(base, 'POST', '/api/equipos', { name: 'Tarde' });
    assert.strictEqual(r.status, 403);

    // votos: 3 para t2, 1 para t1
    for (const [v, t] of [['votante001', t2.id], ['votante002', t2.id], ['votante003', t1.id], ['votante004', t2.id]]) {
      r = await call(base, 'POST', '/api/votar', { voter: v, team: t });
      assert.strictEqual(r.status, 200);
    }
    r = await call(base, 'POST', '/api/votar', { voter: 'votante001', team: t1.id });
    assert.strictEqual(r.status, 409);
    r = await call(base, 'POST', '/api/votar', { voter: 'votante009', team: 'noexiste' });
    assert.strictEqual(r.status, 404);
    r = await call(base, 'POST', '/api/votar', { voter: 'x', team: t1.id });
    assert.strictEqual(r.status, 400);

    // mientras vota, no se ven los resultados
    r = await call(base, 'GET', '/api/estado?voter=votante001');
    assert.strictEqual(r.json.totalVotes, 4);
    assert.strictEqual(r.json.myVote, t2.id);
    assert.strictEqual(r.json.results, undefined);

    // cerrar y ver ganador
    r = await admin('phase', { value: 'cerrada' });
    r = await call(base, 'GET', '/api/estado');
    assert.strictEqual(r.json.results[0].name, 'Ñandú Código');
    assert.strictEqual(r.json.results[0].votes, 3);
    assert.deepStrictEqual(r.json.winners, [t2.id]);
    r = await call(base, 'POST', '/api/votar', { voter: 'votante010', team: t1.id });
    assert.strictEqual(r.status, 403);

    // quitar un equipo borra solo sus votos
    r = await admin('removeTeam', { team: t1.id });
    assert.strictEqual(r.json.teams.length, 2);
    assert.strictEqual(r.json.totalVotes, 3);

    // reiniciar
    r = await admin('reset');
    assert.strictEqual(r.json.phase, 'inscripcion');
    assert.strictEqual(r.json.teams.length, 0);
    assert.strictEqual(r.json.totalVotes, 0);

    console.log('OK: todas las pruebas de la API pasaron.');
  } catch (e) {
    console.error('FALLÓ:', e.message);
    process.exitCode = 1;
  } finally {
    live.close();
  }
})();
