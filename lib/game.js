'use strict';
const crypto = require('crypto');
const store = require('./store');

const PHASES = ['inscripcion', 'votacion', 'cerrada'];
const MAX_TEAMS = 40;
const MAX_VOTES = 1000;

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');

function cleanName(raw) {
  return String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const newId = () => Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
const validVoter = (v) => typeof v === 'string' && /^[a-z0-9]{8,40}$/.test(v);

const only = (names, prefix) => names.filter((n) => n.startsWith(prefix));

async function getPhase(all) {
  const names = all ? only(all, 'config/phase__') : await store.list('config/phase__');
  const p = names.length ? names[0].slice('config/phase__'.length) : 'inscripcion';
  return PHASES.includes(p) ? p : 'inscripcion';
}

async function setPhase(phase) {
  await store.removePrefix('config/phase__');
  if (phase !== 'inscripcion') await store.create('config/phase__' + phase);
}

async function getTeams(all) {
  const names = all ? only(all, 'teams/') : await store.list('teams/');
  return names
    .map((n) => {
      const rest = n.slice('teams/'.length);
      const i = rest.indexOf('__');
      if (i < 1) return null;
      return { id: rest.slice(0, i), name: unb64(rest.slice(i + 2)) };
    })
    .filter(Boolean);
}

async function getVotes(all) {
  const names = all ? only(all, 'votes/') : await store.list('votes/');
  return names
    .map((n) => {
      const rest = n.slice('votes/'.length);
      const i = rest.indexOf('__');
      if (i < 1) return null;
      return { voter: rest.slice(0, i), team: rest.slice(i + 2) };
    })
    .filter(Boolean);
}

/** Foto del estado. Los votos por equipo solo se incluyen si la votación cerró o si pide el admin. */
async function snapshot({ voter, admin } = {}) {
  const all = await store.list('');
  const [phase, teams, votes] = await Promise.all([getPhase(all), getTeams(all), getVotes(all)]);
  const ids = new Set(teams.map((t) => t.id));
  const valid = votes.filter((v) => ids.has(v.team));
  const out = {
    phase,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    totalVotes: valid.length,
    myVote: null,
  };
  if (voter) {
    const mine = valid.find((v) => v.voter === voter);
    out.myVote = mine ? mine.team : null;
  }
  if (phase === 'cerrada' || admin) {
    const counts = {};
    valid.forEach((v) => { counts[v.team] = (counts[v.team] || 0) + 1; });
    const results = teams
      .map((t) => ({ id: t.id, name: t.name, votes: counts[t.id] || 0 }))
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'es'));
    const top = results.length ? results[0].votes : 0;
    out.results = results;
    out.winners = top > 0 ? results.filter((r) => r.votes === top).map((r) => r.id) : [];
  }
  return out;
}

function pinCheck(pin) {
  const real = process.env.ADMIN_PIN || (store.mode() === 'local' ? '1234' : '');
  if (!real) return { ok: false, missing: true };
  const a = crypto.createHash('sha256').update(String(pin == null ? '' : pin)).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return { ok: crypto.timingSafeEqual(a, b) };
}

module.exports = {
  PHASES, MAX_TEAMS, MAX_VOTES,
  b64, cleanName, newId, validVoter,
  getPhase, setPhase, getTeams, getVotes, snapshot, pinCheck,
};
