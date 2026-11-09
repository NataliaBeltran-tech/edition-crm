// Capa de datos: traduce las acciones del panel a consultas a Supabase.
// Todo pasa por la sesión de la usuaria; Row Level Security impide ver datos ajenos.
import * as L from './logic.js';
import { SEED_TEMPLATES } from './seeds.js';

const VERSION = '2.0.0';
const MARKETS = ['co_mx', 'es', 'us'];
const mkt = v => (MARKETS.includes(v) ? v : 'co_mx');
const color = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : null);
const int = v => (v === undefined || v === null || v === '' ? null : Number.parseInt(v, 10));
const fail = (status, message) => Object.assign(new Error(message), { status });
const IG_COLORS = ['#2563EB', '#7AB4FF', '#34C38F', '#E3A33C', '#A78BFA', '#F472B6', '#22D3EE', '#EF5A4C', '#94A3B8', '#FACC15'];

export const META = {
  version: VERSION,
  stages: L.WA_STAGES,
  ig_statuses: L.IG_STATUSES,
  markets: [
    { id: 'co_mx', label: 'Colombia / México (español neutro)' }, { id: 'es', label: 'España' }, { id: 'us', label: 'EE. UU. (inglés)' },
  ],
  countries: [
    { cc: '57', label: 'Colombia (+57)' }, { cc: '52', label: 'México (+52)' }, { cc: '34', label: 'España (+34)' }, { cc: '1', label: 'EE. UU. (+1)' },
  ],
  template_kinds: {
    whatsapp: [
      { id: 'saludo', label: 'Primer mensaje (saludo)' }, { id: 'pitch', label: 'Pitch' }, { id: 'reunion', label: 'Llevar a la reunión' },
      { id: 'seg1_saludo', label: 'Seguimiento 1 · no respondió el saludo', step: 1 },
      { id: 'seg1', label: 'Seguimiento 1', step: 1 }, { id: 'seg2', label: 'Seguimiento 2', step: 2 }, { id: 'seg3', label: 'Seguimiento 3', step: 3 },
      { id: 'seg4', label: 'Seguimiento 4', step: 4 }, { id: 'seg5', label: 'Seguimiento 5', step: 5 }, { id: 'seg_no', label: 'Seguimiento a un "no"' },
    ],
    instagram: [
      { id: 'first', label: 'Primer mensaje' }, { id: 'seg1', label: 'Seguimiento 1', step: 1 }, { id: 'seg2', label: 'Seguimiento 2', step: 2 },
      { id: 'seg3', label: 'Seguimiento 3', step: 3 }, { id: 'seg4', label: 'Seguimiento 4', step: 4 }, { id: 'seg5', label: 'Seguimiento 5', step: 5 },
    ],
  },
};

export function createData(sb) {
  // ---------- utilidades ----------
  const ok = ({ data, error }) => { if (error) throw friendly(error); return data; };
  function friendly(e) {
    const m = String(e.message || e);
    if (/JWT|jwt|session/i.test(m)) return fail(401, 'Tu sesión venció. Vuelve a entrar.');
    if (/Failed to fetch|NetworkError|network/i.test(m)) return fail(0, 'Sin conexión a internet. Revisa tu red e intenta de nuevo.');
    return fail(500, m);
  }
  async function all(build, page = 1000) {
    const out = [];
    for (let from = 0; ; from += page) {
      const rows = ok(await build().range(from, from + page - 1));
      out.push(...rows);
      if (rows.length < page) return out;
    }
  }
  const count = async (build) => { const r = await build(); if (r.error) throw friendly(r.error); return r.count || 0; };
  const sod = () => L.startOfDay(Date.now());

  let settingsCache = null, tplCache = null;
  async function getSettings(force = false) {
    if (settingsCache && !force) return settingsCache;
    const rows = ok(await sb.from('settings').select('key,value'));
    settingsCache = { ...L.DEFAULT_SETTINGS };
    for (const r of rows) settingsCache[r.key] = r.value ?? '';
    return settingsCache;
  }
  async function setSettings(obj) {
    const rows = Object.entries(obj).map(([key, value]) => ({ key, value: String(value ?? '') }));
    if (rows.length) ok(await sb.from('settings').upsert(rows, { onConflict: 'user_id,key' }));
    settingsCache = null;
    return getSettings();
  }
  async function templates(force = false) {
    if (tplCache && !force) return tplCache;
    tplCache = ok(await sb.from('templates').select('*').order('kind').order('market').order('id'));
    return tplCache;
  }
  async function ensureSeed() {
    const n = await count(() => sb.from('templates').select('id', { count: 'exact', head: true }));
    if (!n) ok(await sb.from('templates').insert(SEED_TEMPLATES.map(t => ({ name: t.name, kind: t.kind, channel: t.channel, market: t.market, rubro: '', body: t.body }))));
    tplCache = null;
  }
  const contactOut = c => c && ({ ...c, tags: Array.isArray(c.tags) ? c.tags : [], extra: c.extra || {}, phone_pretty: L.prettyPhone(c.phone), person_name: L.personName(c.name) });
  const getContact = async id => ok(await sb.from('contacts').select('*').eq('id', id).maybeSingle());
  async function updContact(id, patch) {
    if (patch && Object.keys(patch).length) ok(await sb.from('contacts').update(patch).eq('id', id));
    const c = ok(await sb.from('contacts').select('*, imports(name), accounts(name)').eq('id', id).single());
    return { ...c, import_name: c.imports?.name, account_name: c.accounts?.name };
  }

  // ---------- cuentas ----------
  const waAccounts = async () => ok(await sb.from('accounts').select('*').order('id'));
  const igAccountsRaw = async () => ok(await sb.from('ig_accounts').select('*').order('id'));
  async function sentToday(accountId) {
    return count(() => sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('account_id', accountId).eq('direction', 'out').eq('kind', 'saludo').gte('ts', sod()));
  }
  async function igSentToday(accountId) {
    return count(() => sb.from('ig_contact_log').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('kind', 'first').gte('ts', sod()));
  }
  const unassignedWa = () => count(() => sb.from('contacts').select('id', { count: 'exact', head: true }).eq('stage', 'por_contactar').is('greeting_at', null).is('account_id', null).or('has_wa.is.null,has_wa.neq.0'));
  const pending = async (channel, id) => ok(await sb.rpc('crm_pending', { p_channel: channel, p_account: id }));
  async function activeWa() {
    const s = await getSettings(); const accs = await waAccounts();
    return accs.find(a => String(a.id) === String(s.wa_active_account)) || accs[0] || null;
  }
  async function activeIg() {
    const s = await getSettings(); const accs = await igAccountsRaw();
    return accs.find(a => String(a.id) === String(s.ig_active_account)) || accs[0] || null;
  }
  async function waitSec(accountId) {
    const s = await getSettings();
    const t = Number(s[`wa_next_${accountId}`] || 0);
    return Math.max(0, Math.ceil((t - Date.now()) / 1000));
  }
  async function activeContacts() {
    return all(() => sb.from('contacts').select('id,name,phone,stage,rubro,market,account_id,import_id,fu_count,last_in_at,last_out_at,pitch_at,greeting_at,meeting_at,snooze_until,stage_changed_at,unread,tags,extra,city').neq('stage', 'por_contactar').order('id'));
  }
  async function accountsOut() {
    const [accs, s, contacts] = await Promise.all([waAccounts(), getSettings(), activeContacts()]);
    return Promise.all(accs.map(async a => {
      const [sent, pend, w] = await Promise.all([sentToday(a.id), pending('whatsapp', a.id), waitSec(a.id)]);
      const t = L.todayTasks(contacts.filter(c => c.account_id === a.id), s);
      return { ...a, sent_today: sent, full: sent >= a.daily_limit, pending: pend, followups: t.seguimiento.length + t.retomar_no.length,
        wait_sec: w, active_here: String(a.id) === String(s.wa_active_account) || (!s.wa_active_account && a.id === accs[0].id) };
    }));
  }
  async function igAccountsOut() {
    const [accs, s, leads] = await Promise.all([igAccountsRaw(), getSettings(), all(() => sb.from('ig_leads').select('id,status,fu_count,last_contact_at,snooze_until,account_id').eq('status', 'contactado').order('id'))]);
    return Promise.all(accs.map(async a => {
      const [sent, pend] = await Promise.all([igSentToday(a.id), pending('instagram', a.id)]);
      return { ...a, sent_today: sent, full: sent >= a.daily_limit, pending: pend,
        followups: L.igFollowups(leads.filter(l => l.account_id === a.id || !l.account_id), s).length,
        active_here: String(a.id) === String(s.ig_active_account) || (!s.ig_active_account && a.id === accs[0].id) };
    }));
  }

  // ---------- CSV ----------
  const p2 = n => String(n).padStart(2, '0');
  const fmtDate = ts => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  function csv(rows, cols) {
    const esc = v => { let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
  }

  // =================== Router ===================
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  on('GET', '/meta', async () => META);
  on('GET', '/settings', async () => getSettings(true));
  on('PATCH', '/settings', async (_, b) => {
    const out = {};
    for (const [k, v] of Object.entries(b || {})) {
      if (!(k in L.DEFAULT_SETTINGS)) continue;
      let val = String(v ?? '').trim();
      if (k === 'fu_no_days') val = String(Math.max(1, parseInt(val, 10) || 30));
      if (k === 'min_delay_sec' || k === 'max_delay_sec') val = String(Math.max(10, parseInt(val, 10) || 90));
      if (k === 'meeting_push_hours') val = String(Math.max(1, parseFloat(val) || 24));
      if (k === 'seq_days') val = val.split(',').map(x => Math.max(1, parseInt(x, 10) || 1)).slice(0, 5).join(',');
      if (k === 'country_code') val = val.replace(/\D/g, '') || '57';
      if ((k === 'work_start' || k === 'work_end') && !/^\d{2}:\d{2}$/.test(val)) continue;
      if (k === 'work_days') val = val.split(',').map(Number).filter(n => n >= 1 && n <= 7).join(',');
      if (k === 'auto_classify') val = val === '1' || val === 'true' ? '1' : '0';
      if (k === 'calendly_url' && val && !/^https:\/\//i.test(val)) val = 'https://' + val;
      out[k] = val;
    }
    return setSettings(out);
  });

  // ----- cuentas WhatsApp -----
  on('GET', '/accounts', accountsOut);
  on('POST', '/accounts', async (_, b) => {
    if (!String(b?.name || '').trim()) throw fail(400, 'Ponle un nombre a la cuenta.');
    const a = ok(await sb.from('accounts').insert({ name: String(b.name).trim(), phone: String(b.phone || '').replace(/[^\d+]/g, ''), daily_limit: Math.max(1, int(b.daily_limit) || 15) }).select().single());
    const s = await getSettings(); if (!s.wa_active_account) await setSettings({ wa_active_account: a.id });
    return a;
  });
  on('PATCH', '/accounts/:id', async (p, b) => {
    const patch = {};
    if (b.name !== undefined) patch.name = String(b.name).trim();
    if (b.phone !== undefined) patch.phone = String(b.phone || '').replace(/[^\d+]/g, '');
    if (b.daily_limit !== undefined) patch.daily_limit = Math.max(1, int(b.daily_limit) || 15);
    return ok(await sb.from('accounts').update(patch).eq('id', p.id).select().single());
  });
  on('DELETE', '/accounts/:id', async (p) => {
    ok(await sb.from('contacts').update({ account_id: null }).eq('account_id', p.id).is('greeting_at', null));
    ok(await sb.from('accounts').delete().eq('id', p.id));
    const s = await getSettings();
    if (String(s.wa_active_account) === String(p.id)) { const o = (await waAccounts())[0]; await setSettings({ wa_active_account: o ? o.id : '' }); }
    return { ok: true };
  });

  // ----- plantillas -----
  on('GET', '/templates', async (_, __, q) => (await templates(true)).filter(t => t.channel === (q.channel || 'whatsapp')));
  on('POST', '/templates', async (_, b) => {
    if (!b.kind || !String(b.body || '').trim()) throw fail(400, 'La plantilla necesita tipo y texto.');
    const r = ok(await sb.from('templates').insert({ name: String(b.name || '').trim() || 'Variante', kind: b.kind, channel: b.channel === 'instagram' ? 'instagram' : 'whatsapp', rubro: String(b.rubro || '').trim(), body: String(b.body).trim(), market: mkt(b.market) }).select().single());
    tplCache = null; return r;
  });
  on('PATCH', '/templates/:id', async (p, b) => {
    if (!String(b.body || '').trim()) throw fail(400, 'El texto no puede quedar vacío.');
    const r = ok(await sb.from('templates').update({ name: String(b.name || '').trim(), kind: b.kind, rubro: String(b.rubro || '').trim(), body: String(b.body).trim(), market: mkt(b.market) }).eq('id', p.id).select().single());
    tplCache = null; return r;
  });
  on('DELETE', '/templates/:id', async (p) => { ok(await sb.from('templates').delete().eq('id', p.id)); tplCache = null; return { ok: true }; });
  on('POST', '/templates/preview', async (_, b) => ({ text: L.renderTemplate(b.body || '', { ...(b.contact || {}), _settings: await getSettings() }, mkt(b.market)) }));

  async function renderKind(c, kind, excludeId) {
    const map = { saludo: 'saludo', pitch: 'pitch', reunion: 'reunion', seguimiento_no: 'seg_no' };
    let tk = map[kind];
    if (kind === 'seguimiento') tk = L.followupKind(c, Math.min(5, (c.fu_count || 0) + 1));
    if (!tk) return { template_id: null, body: '' };
    return L.buildMessage(await templates(), await getSettings(), tk, c, 'whatsapp', excludeId);
  }
  on('GET', '/contacts/:id/render', async (p, _, q) => {
    const c = await getContact(p.id); if (!c) throw fail(404, 'No encontré ese contacto.');
    return renderKind(c, q.kind || 'pitch', int(q.exclude));
  });

  // ----- importar y listas -----
  on('POST', '/import/:ch', async (p, b) => {
    const ch = p.ch === 'instagram' ? 'instagram' : 'whatsapp';
    const cc = String(b.country || (await getSettings()).country_code || '57').replace(/\D/g, '');
    const seen = new Set(), rows = [], out = { total: (b.rows || []).length, valid: 0, duplicated: 0, dup_file: 0, dup_db: 0, invalid: 0, invalid_examples: [] };
    for (const r of b.rows || []) {
      const key = ch === 'whatsapp' ? L.normalizePhone(r.phone, cc) : L.extractIgUser(r.username);
      if (!key) {
        out.invalid++;
        if (out.invalid_examples.length < 6) out.invalid_examples.push((String((ch === 'whatsapp' ? r.phone : r.username) ?? '').trim() || '(vacío)') + (r.name ? ` · ${r.name}` : ''));
        continue;
      }
      if (seen.has(key)) { out.duplicated++; out.dup_file++; continue; }
      seen.add(key);
      rows.push(ch === 'whatsapp'
        ? { phone: key, name: String(r.name || '').trim(), city: String(r.city || '').trim(), extra: r.extra || {} }
        : { username: key, name: String(r.name || '').trim(), followers: r.followers === '' || r.followers == null ? '' : String(L.parseFollowers(r.followers) ?? ''), extra: r.extra || {} });
    }
    const meta = { name: b.name, filename: b.filename, rubro: String(b.rubro || '').trim(), market: mkt(b.market), country: cc, total: out.total, dup_file: out.dup_file, invalid: out.invalid, account_ids: (b.account_ids || []).map(Number).filter(Boolean) };
    if (b.dry_run) {
      let dup = 0;
      for (let i = 0; i < rows.length; i += 1000) dup += ok(await sb.rpc('crm_import', { p_channel: ch, p_meta: meta, p_rows: rows.slice(i, i + 1000), p_dry: true })).dup_db;
      return { ...out, dup_db: dup, duplicated: out.duplicated + dup, valid: rows.length - dup };
    }
    if (rows.length > 5000) throw fail(400, 'El archivo tiene más de 5.000 filas válidas. Divídelo en partes.');
    const r = ok(await sb.rpc('crm_import', { p_channel: ch, p_meta: meta, p_rows: rows, p_dry: false }));
    return { ...out, added: r.added, duplicated: out.duplicated + r.dup_db, import_id: r.import_id };
  });
  on('GET', '/imports', async (_, __, q) => ok(await sb.rpc('crm_import_stats', { p_channel: q.channel === 'instagram' ? 'instagram' : 'whatsapp' })));
  on('PATCH', '/imports/:id', async (p, b) => {
    const imp = ok(await sb.from('imports').select('*').eq('id', p.id).maybeSingle()); if (!imp) throw fail(404, 'No encontré esa lista.');
    const patch = {}; if (b.name !== undefined) patch.name = String(b.name).trim();
    if (b.market !== undefined) {
      patch.market = mkt(b.market);
      ok(await sb.from(imp.channel === 'whatsapp' ? 'contacts' : 'ig_leads').update({ market: patch.market }).eq('import_id', p.id));
    }
    return ok(await sb.from('imports').update(patch).eq('id', p.id).select().single());
  });
  on('POST', '/imports/:id/distribute', async (p, b) => {
    const accs = (b.account_ids || []).map(Number).filter(Boolean);
    if (!accs.length) throw fail(400, 'Elige al menos una cuenta.');
    return { ok: true, distributed: ok(await sb.rpc('crm_distribute', { p_import: Number(p.id), p_accounts: accs })) };
  });
  on('DELETE', '/imports/:id', async (p) => ({ ok: true, deleted: ok(await sb.rpc('crm_delete_import', { p_import: Number(p.id) })) }));

  // ----- contactos -----
  on('GET', '/contacts', async (_, __, q) => {
    const limit = Math.min(500, int(q.limit) || 100), page = Math.max(0, int(q.page) || 0);
    let qb = sb.from('contacts').select('*, imports(name), accounts(name)', { count: 'exact' });
    if (q.stage) qb = qb.eq('stage', q.stage);
    if (q.import_id) qb = q.import_id === 'none' ? qb.is('import_id', null) : qb.eq('import_id', int(q.import_id));
    if (q.account_id) qb = qb.eq('account_id', int(q.account_id));
    if (q.q) { const s = String(q.q).replace(/[%,()*]/g, ' ').trim(); const d = s.replace(/\D/g, ''); qb = qb.or(`name.ilike.*${s}*,rubro.ilike.*${s}*,notes.ilike.*${s}*,city.ilike.*${s}*${d ? `,phone.ilike.*${d}*` : ''}`); }
    const r = await qb.order('last_out_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true }).range(page * limit, page * limit + limit - 1);
    if (r.error) throw friendly(r.error);
    return { total: r.count || 0, rows: r.data.map(c => contactOut({ ...c, import_name: c.imports?.name, account_name: c.accounts?.name })) };
  });
  on('GET', '/contacts/:id', async (p) => {
    const c = ok(await sb.from('contacts').select('*, imports(name), accounts(name)').eq('id', p.id).maybeSingle());
    if (!c) throw fail(404, 'No encontré ese contacto.');
    return contactOut({ ...c, import_name: c.imports?.name, account_name: c.accounts?.name });
  });
  on('PATCH', '/contacts/:id', async (p, b) => {
    const c = await getContact(p.id); if (!c) throw fail(404, 'No encontré ese contacto.');
    let patch = {};
    for (const k of ['notes', 'name', 'rubro', 'city']) if (b[k] !== undefined) patch[k] = String(b[k] || '');
    if (b.tags !== undefined) patch.tags = Array.isArray(b.tags) ? b.tags : [];
    if (b.market !== undefined) patch.market = mkt(b.market);
    if (b.stage) Object.assign(patch, L.stagePatch(c, b.stage) || {});
    if (b.meeting_at !== undefined) {
      const m = b.meeting_at ? Number(b.meeting_at) : null;
      patch.meeting_at = m;
      if (m && !b.stage) Object.assign(patch, L.stagePatch({ ...c, ...patch }, 'reunion') || {});
    }
    if (b.snooze_days !== undefined) { const n = int(b.snooze_days); patch.snooze_until = n ? L.addDays(L.startOfDay(Date.now()), n) : null; }
    if (b.has_wa !== undefined) patch.has_wa = b.has_wa === null ? null : Number(b.has_wa);
    return contactOut(await updContact(p.id, patch));
  });
  on('POST', '/contacts/:id/discard', async (p, b) => {
    const c = await getContact(p.id); if (!c) throw fail(404, 'No encontré ese contacto.');
    return contactOut(await updContact(p.id, { ...(L.stagePatch(c, 'perdido') || {}), reason: String(b?.reason || 'no_sirve') }));
  });
  on('DELETE', '/contacts/:id', async (p) => { ok(await sb.from('contacts').delete().eq('id', p.id)); return { ok: true }; });
  on('GET', '/contacts/:id/messages', async (p) => {
    const [rows, accs] = await Promise.all([ok(await sb.from('messages').select('*').eq('contact_id', p.id).order('ts', { ascending: false }).limit(200)), waAccounts()]);
    const names = Object.fromEntries(accs.map(a => [a.id, a.name]));
    return rows.reverse().map(m => ({ ...m, account_name: names[m.account_id] || '' }));
  });

  // Registrar que enviaste un mensaje (pitch, seguimiento, reunión o libre). El saludo va por /send/greeting.
  on('POST', '/contacts/:id/sent', async (p, b) => {
    const kind = b.kind || 'manual', body = String(b.body || '').trim();
    if (!['pitch', 'seguimiento', 'seguimiento_no', 'reunion', 'manual'].includes(kind)) throw fail(400, kind === 'saludo' ? 'El primer mensaje se registra desde "Contactar hoy".' : 'Tipo de mensaje no válido.');
    if (!body) throw fail(400, 'El mensaje está vacío.');
    const c = await getContact(p.id); if (!c) throw fail(404, 'No encontré ese contacto.');
    let accountId = c.account_id;
    if (!accountId) accountId = (await activeWa())?.id || null;
    const t = Date.now();
    ok(await sb.from('messages').insert({ contact_id: c.id, account_id: accountId, direction: 'out', kind, body, template_id: b.template_id || null, ts: t }));
    let patch = { last_out_at: t, unread: 0, account_id: accountId };
    if (kind === 'pitch') Object.assign(patch, L.stagePatch(c, 'pitch_enviado', true, t), { pitch_at: t, last_out_at: t });
    else if (kind === 'seguimiento') patch.fu_count = (c.fu_count || 0) + 1;
    else if (kind === 'seguimiento_no') patch.fu_count = 1;
    else if (c.stage === 'por_contactar') Object.assign(patch, L.stagePatch(c, 'contactado', false, t));
    return contactOut(await updContact(c.id, patch));
  });
  // Registrar una respuesta del lead (pegada o solo "Respondió")
  on('POST', '/contacts/:id/reply', async (p, b) => {
    const c = await getContact(p.id); if (!c) throw fail(404, 'No encontré ese contacto.');
    const text = String(b?.text || '').trim(), t = Date.now();
    ok(await sb.from('messages').insert({ contact_id: c.id, account_id: c.account_id, direction: 'in', kind: 'manual', body: text || '(respondió)', ts: t }));
    return contactOut(await updContact(c.id, L.incomingPatch(c, text, await getSettings(), t)));
  });

  // ----- primer mensaje de WhatsApp -----
  async function quota(acc) { const sent = await sentToday(acc.id); return { enviados: sent, cupo: acc.daily_limit, llena: sent >= acc.daily_limit }; }
  on('GET', '/send/next', async (_, __, q) => {
    const s = await getSettings();
    const acc = q.account_id ? (await waAccounts()).find(a => a.id === Number(q.account_id)) : await activeWa();
    if (!acc) return { lead: null, no_account: true, in_hours: L.inWorkHours(s) };
    const exclude = String(q.exclude || '').split(',').map(Number).filter(Boolean);
    const r = ok(await sb.rpc('crm_next_wa', { p_account: acc.id, p_import: int(q.import_id), p_exclude: exclude }));
    const lead = r.lead ? contactOut(r.lead) : null;
    return {
      account_id: acc.id, lead, remaining: r.remaining, quota: await quota(acc), wait_sec: await waitSec(acc.id), in_hours: L.inWorkHours(s),
      message: lead ? L.buildMessage(await templates(), s, 'saludo', lead, 'whatsapp', int(q.exclude_template)) : null,
    };
  });
  on('POST', '/send/greeting', async (_, b) => {
    const body = String(b.body || '').trim();
    if (!body) throw fail(400, 'El mensaje está vacío.');
    const acc = (await waAccounts()).find(a => a.id === Number(b.account_id)) || await activeWa();
    if (!acc) throw fail(409, 'Primero agrega tu cuenta de WhatsApp.');
    const s = await getSettings();
    let a = Number(s.min_delay_sec) || 90, z = Number(s.max_delay_sec) || 240; if (z < a) [a, z] = [z, a];
    const next = Date.now() + Math.round((a + Math.random() * (z - a)) * 1000);
    const r = await sb.rpc('crm_register_greeting', { p_contact: Number(b.contact_id), p_account: acc.id, p_body: body, p_template: b.template_id || null, p_day_start: sod(), p_next_ts: next });
    if (r.error) throw fail(409, String(r.error.message || 'No se pudo registrar.'));
    settingsCache = null;
    return { ok: true, wait_sec: await waitSec(acc.id), quota: { enviados: r.data.sent, cupo: r.data.limit, llena: r.data.sent >= r.data.limit } };
  });

  // ----- conversaciones, hoy, contadores, tablero, métricas, embudo -----
  on('GET', '/inbox', async (_, __, q) => {
    let rows = await all(() => sb.from('contacts').select('id,name,phone,stage,unread,rubro,last_in_at,last_out_at,meeting_at,account_id,accounts(name)')
      .or('greeting_at.not.is.null,last_out_at.not.is.null,last_in_at.not.is.null').order('id'));
    if (q.q) {
      const t = String(q.q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), d = t.replace(/\D/g, '');
      rows = rows.filter(r => String(r.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t) || (d && String(r.phone).includes(d)));
    }
    const last = new Map((await all(() => sb.rpc('crm_last_messages').order('contact_id'))).map(m => [m.contact_id, m]));
    return rows.map(r => ({ ...r, account_name: r.accounts?.name, phone_pretty: L.prettyPhone(r.phone), last_body: last.get(r.id)?.body || '', last_dir: last.get(r.id)?.direction || (r.last_in_at > r.last_out_at ? 'in' : 'out') }))
      .sort((a, b) => Math.max(b.last_in_at || 0, b.last_out_at || 0) - Math.max(a.last_in_at || 0, a.last_out_at || 0));
  });
  on('GET', '/today', async (_, __, q) => {
    const contacts = (await activeContacts()).filter(c => !q.account_id || c.account_id === Number(q.account_id));
    const g = L.todayTasks(contacts, await getSettings());
    const out = {}; for (const [k, l] of Object.entries(g)) out[k] = l.slice(0, 300).map(contactOut);
    return out;
  });
  async function igFollowupsAll() {
    const leads = await all(() => sb.from('ig_leads').select('*, imports(name)').eq('status', 'contactado').order('id'));
    return L.igFollowups(leads, await getSettings());
  }
  on('GET', '/counters', async () => {
    const [s, contacts, wa, ig] = await Promise.all([getSettings(), activeContacts(), activeWa(), activeIg()]);
    const g = L.todayTasks(contacts, s);
    const tasks = Object.values(g).reduce((n, l) => n + l.length, 0);
    let waLeft = 0;
    const unassigned = await unassignedWa();
    if (wa) { const q = await quota(wa); waLeft = Math.min(Math.max(0, q.cupo - q.enviados), await pending('whatsapp', wa.id) + unassigned); }
    let igLeft = 0;
    if (ig) igLeft = Math.min(Math.max(0, ig.daily_limit - await igSentToday(ig.id)), await count(() => sb.from('ig_leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo').or(`account_id.eq.${ig.id},account_id.is.null`)));
    const igFu = (await igFollowupsAll()).length;
    return { wa_unassigned: unassigned, wa_pending: waLeft + tasks, wa_tasks: tasks, wa_left: waLeft, wa_unread: g.escribieron.length, ig_pending: igLeft + igFu, ig_left: igLeft, ig_followups: igFu };
  });
  on('GET', '/dashboard', async () => {
    const t = Date.now(), d0 = sod();
    const [s, accs, igAccs, contacts, igFu] = await Promise.all([getSettings(), waAccounts(), igAccountsRaw(), activeContacts(), igFollowupsAll()]);
    const g = L.todayTasks(contacts, s);
    const waSentArr = await Promise.all(accs.map(a => sentToday(a.id)));
    const igSentArr = await Promise.all(igAccs.map(a => igSentToday(a.id)));
    const waSent = waSentArr.reduce((a, b) => a + b, 0), waCap = accs.reduce((n, a) => n + a.daily_limit, 0);
    const igSent = igSentArr.reduce((a, b) => a + b, 0), igCap = igAccs.reduce((n, a) => n + a.daily_limit, 0);
    const waReplies = new Set(ok(await sb.from('messages').select('contact_id').eq('direction', 'in').gte('ts', d0)).map(m => m.contact_id)).size;
    const igReplies = await count(() => sb.from('ig_leads').select('id', { count: 'exact', head: true }).gte('replied_at', d0));
    const weekAgo = L.addDays(d0, -6);
    const waWeek = ok(await sb.from('contacts').select('replied_at').gte('greeting_at', weekAgo));
    const igWeek = ok(await sb.from('ig_leads').select('replied_at').gte('first_contact_at', weekAgo));
    const until = L.addDays(d0, 30), from = d0 - 3 * 3600000;
    const mWa = ok(await sb.from('contacts').select('id,name,phone,meeting_at').gte('meeting_at', from).lt('meeting_at', until).neq('stage', 'perdido')).map(m => ({ ...m, channel: 'whatsapp' }));
    const mIg = ok(await sb.from('ig_leads').select('id,name,username,meeting_at').gte('meeting_at', from).lt('meeting_at', until).neq('status', 'descartado')).map(m => ({ ...m, name: m.name || '@' + m.username, channel: 'instagram' }));
    const monday = L.addDays(d0, -((new Date(t).getDay() + 6) % 7));
    const agenda = [...mWa, ...mIg].sort((a, b) => a.meeting_at - b.meeting_at);
    const waNew = await Promise.all(accs.map(a => pending('whatsapp', a.id)));
    const unassigned = await unassignedWa();
    const actId = (await activeWa())?.id;
    const waLeft = accs.reduce((n, a, i) => n + Math.min(Math.max(0, a.daily_limit - waSentArr[i]), waNew[i] + (a.id === actId ? unassigned : 0)), 0);
    const igNew = await count(() => sb.from('ig_leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo'));
    const rate = rows => (rows.length ? Math.round(rows.filter(r => r.replied_at).length / rows.length * 100) : 0);
    return {
      kpis: { first_today: waSent + igSent, first_cap: waCap + igCap, followups: g.seguimiento.length + g.retomar_no.length + igFu.length, replies_today: waReplies + igReplies,
        meetings_week: agenda.filter(m => m.meeting_at >= monday && m.meeting_at < L.addDays(monday, 7)).length },
      whatsapp: { accounts: accs.length, sent: waSent, cap: waCap, left: waLeft, followups: g.seguimiento.length + g.retomar_no.length, replies: waReplies,
        to_answer: g.escribieron.length + g.pitch.length + g.reunion_push.length, week_rate: rate(waWeek), week_sent: waWeek.length },
      instagram: { accounts: igAccs.length, sent: igSent, cap: igCap, left: Math.min(Math.max(0, igCap - igSent), igNew), followups: igFu.length, replies: igReplies,
        week_rate: rate(igWeek), week_sent: igWeek.length },
      agenda,
    };
  });
  on('GET', '/metrics', async () => {
    const m = ok(await sb.rpc('crm_metrics'));
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    const withRates = r => ({ ...r, tasa_respuesta: pct(r.respondieron, r.contactados) });
    const f = m.funnel;
    f.tasa_respuesta = pct(f.respondieron, f.contactados); f.tasa_interes = pct(f.interesados, f.respondieron); f.tasa_reunion = pct(f.reuniones, f.contactados);
    const start = L.addDays(sod(), -13);
    const msgs = await all(() => sb.from('messages').select('ts,direction,kind').gte('ts', start).order('id'));
    const days = Array.from({ length: 14 }, (_, i) => ({ day: L.addDays(start, i), saludos: 0, enviados: 0, recibidos: 0 }));
    for (const x of msgs) {
      const i = days.findIndex((d, j) => x.ts >= d.day && x.ts < (days[j + 1]?.day ?? L.addDays(d.day, 1)));
      if (i < 0) continue;
      if (x.direction === 'in') days[i].recibidos++; else { days[i].enviados++; if (x.kind === 'saludo') days[i].saludos++; }
    }
    const igf = m.ig.funnel; igf.tasa_respuesta = pct(igf.respondieron, igf.contactados); igf.tasa_reunion = pct(igf.reuniones, igf.contactados);
    return { funnel: f, byAccount: m.byAccount.map(withRates), byRubro: m.byRubro.map(withRates), byTemplate: m.byTemplate.map(withRates), days,
      instagram: { funnel: igf, byAccount: m.ig.byAccount.map(withRates) } };
  });
  on('GET', '/funnel', async () => {
    const wa = await all(() => sb.from('contacts').select('id,name,phone,stage,rubro').or('stage.neq.por_contactar,greeting_at.not.is.null').order('id'));
    const ig = await all(() => sb.from('ig_leads').select('id,username,name,status,rubro').neq('status', 'nuevo').order('id'));
    return { wa, ig,
      wa_new: await count(() => sb.from('contacts').select('id', { count: 'exact', head: true }).eq('stage', 'por_contactar').is('greeting_at', null)),
      ig_new: await count(() => sb.from('ig_leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo')) };
  });

  // ----- Instagram -----
  on('GET', '/ig/accounts', igAccountsOut);
  on('POST', '/ig/accounts', async (_, b) => {
    if (!String(b.name || '').trim()) throw fail(400, 'Ponle un nombre a la cuenta.');
    const n = (await igAccountsRaw()).length;
    const a = ok(await sb.from('ig_accounts').insert({ name: String(b.name).trim(), username: L.extractIgUser(b.username) || '', color: color(b.color) || IG_COLORS[n % IG_COLORS.length], daily_limit: Math.max(1, int(b.daily_limit) || 30), notes: String(b.notes || '') }).select().single());
    const s = await getSettings(); if (!s.ig_active_account) await setSettings({ ig_active_account: a.id });
    return a;
  });
  on('PATCH', '/ig/accounts/:id', async (p, b) => ok(await sb.from('ig_accounts').update({
    name: String(b.name || '').trim() || undefined, username: L.extractIgUser(b.username) || '', color: color(b.color) || undefined,
    daily_limit: Math.max(1, int(b.daily_limit) || 30), notes: String(b.notes || ''),
  }).eq('id', p.id).select().single()));
  on('DELETE', '/ig/accounts/:id', async (p) => {
    ok(await sb.from('ig_leads').update({ account_id: null }).eq('account_id', p.id).eq('status', 'nuevo'));
    ok(await sb.from('ig_accounts').delete().eq('id', p.id));
    const s = await getSettings();
    if (String(s.ig_active_account) === String(p.id)) { const o = (await igAccountsRaw())[0]; await setSettings({ ig_active_account: o ? o.id : '' }); }
    return { ok: true };
  });
  on('GET', '/ig', async (_, __, q) => {
    const limit = Math.min(500, int(q.limit) || 100), page = Math.max(0, int(q.page) || 0);
    let qb = sb.from('ig_leads').select('*, imports(name), ig_accounts(name,color)', { count: 'exact' });
    if (q.status) qb = qb.eq('status', q.status);
    if (q.account_id) qb = qb.eq('account_id', int(q.account_id));
    if (q.import_id) qb = qb.eq('import_id', int(q.import_id));
    if (q.q) { const s = String(q.q).replace(/^@/, '').replace(/[%,()*]/g, ' ').trim(); qb = qb.or(`username.ilike.*${s}*,name.ilike.*${s}*,rubro.ilike.*${s}*,notes.ilike.*${s}*`); }
    qb = q.sort === 'followers' ? qb.order('followers', { ascending: false, nullsFirst: false }) : qb.order('last_contact_at', { ascending: false, nullsFirst: false }).order('id');
    const r = await qb.range(page * limit, page * limit + limit - 1);
    if (r.error) throw friendly(r.error);
    return { total: r.count || 0, rows: r.data.map(l => ({ ...l, import_name: l.imports?.name, account_name: l.ig_accounts?.name, account_color: l.ig_accounts?.color })) };
  });
  on('GET', '/ig/lead/:id', async (p) => {
    const l = ok(await sb.from('ig_leads').select('*, imports(name), ig_accounts(name)').eq('id', p.id).maybeSingle());
    if (!l) throw fail(404, 'No encontré ese lead.');
    return { ...l, import_name: l.imports?.name, account_name: l.ig_accounts?.name };
  });
  on('PATCH', '/ig/:id', async (p, b) => {
    const l = ok(await sb.from('ig_leads').select('*').eq('id', p.id).maybeSingle()); if (!l) throw fail(404, 'No encontré ese lead.');
    let patch = {};
    for (const k of ['notes', 'name', 'rubro']) if (b[k] !== undefined) patch[k] = String(b[k] || '');
    if (b.followers !== undefined) patch.followers = b.followers === '' || b.followers === null ? null : L.parseFollowers(b.followers);
    if (b.account_id !== undefined) patch.account_id = int(b.account_id);
    if (b.status && b.status !== l.status) Object.assign(patch, L.igStatusPatch(l, b.status) || {});
    if (b.meeting_at !== undefined) {
      const m = b.meeting_at ? Number(b.meeting_at) : null; patch.meeting_at = m;
      if (m && !b.status) Object.assign(patch, L.igStatusPatch({ ...l, ...patch }, 'reunion') || {});
    }
    if (b.snooze_days !== undefined) { const n = int(b.snooze_days); patch.snooze_until = n ? L.addDays(L.startOfDay(Date.now()), n) : null; }
    if (!Object.keys(patch).length) return l;
    return ok(await sb.from('ig_leads').update(patch).eq('id', p.id).select().single());
  });
  async function igQuota(acc) { const sent = await igSentToday(acc.id); return { enviados: sent, cupo: acc.daily_limit, llena: sent >= acc.daily_limit }; }
  on('GET', '/ig/next', async (_, __, q) => {
    const acc = q.account_id ? (await igAccountsRaw()).find(a => a.id === Number(q.account_id)) : await activeIg();
    if (!acc) return { lead: null, no_account: true };
    const s = await getSettings();
    const exclude = String(q.exclude || '').split(',').map(Number).filter(Boolean);
    const r = ok(await sb.rpc('crm_next_ig', { p_account: acc.id, p_import: int(q.import_id), p_exclude: exclude }));
    return { account_id: acc.id, lead: r.lead, remaining: r.remaining, quota: await igQuota(acc), in_hours: L.inWorkHours(s),
      message: r.lead ? L.buildMessage(await templates(), s, 'first', r.lead, 'instagram', int(q.exclude_template)) : null };
  });
  on('POST', '/ig/:id/contacted', async (p, b) => {
    const l = ok(await sb.from('ig_leads').select('*').eq('id', p.id).maybeSingle()); if (!l) throw fail(404, 'No encontré ese lead.');
    const acc = (await igAccountsRaw()).find(a => a.id === Number(b.account_id || l.account_id)) || await activeIg();
    if (!acc) throw fail(409, 'Primero agrega tu cuenta de Instagram.');
    const kind = b.kind === 'followup' ? 'followup' : 'first';
    if (kind === 'followup' && (l.status !== 'contactado' || !L.dueStep(l.fu_count, l.last_contact_at, await getSettings()))) throw fail(409, 'Este seguimiento ya se registró.');
    const r = await sb.rpc('crm_ig_contacted', { p_lead: l.id, p_account: acc.id, p_kind: kind, p_day_start: sod() });
    if (r.error) throw fail(409, String(r.error.message || 'No se pudo registrar.'));
    return { ok: true, quota: { enviados: r.data.sent, cupo: r.data.limit, llena: r.data.sent >= r.data.limit } };
  });
  on('POST', '/ig/:id/replied', async (p) => {
    const l = ok(await sb.from('ig_leads').select('*').eq('id', p.id).maybeSingle()); if (!l) throw fail(404, 'No encontré ese lead.');
    ok(await sb.from('ig_leads').update({ ...(L.igStatusPatch(l, 'respondio') || {}), replied_at: l.replied_at ?? Date.now(), fu_count: 0 }).eq('id', l.id));
    return { ok: true };
  });
  on('POST', '/ig/:id/discard', async (p, b) => {
    ok(await sb.from('ig_leads').update({ status: 'descartado', reason: b?.reason === 'no_existe' ? 'no_existe' : 'no_sirve', status_changed_at: Date.now() }).eq('id', p.id));
    return { ok: true };
  });
  on('GET', '/ig/followups', async () => {
    const [list, tpl, s] = await Promise.all([igFollowupsAll(), templates(), getSettings()]);
    return list.slice(0, 300).map(l => ({ ...l, import_name: l.imports?.name, message: L.buildMessage(tpl, s, 'seg' + l.step, l, 'instagram') }));
  });
  on('GET', '/ig/followups/:id/render', async (p, _, q) => {
    const l = ok(await sb.from('ig_leads').select('*').eq('id', p.id).maybeSingle()); if (!l) throw fail(404, 'No encontré ese lead.');
    return L.buildMessage(await templates(), await getSettings(), 'seg' + Math.min(5, (l.fu_count || 0) + 1), l, 'instagram', int(q.exclude));
  });

  // ----- exportar (genera el CSV en el navegador) -----
  on('GET', '/export/:ch', async (p, _, q) => {
    const day = fmtDate(Date.now()).slice(0, 10), imp = int(q.import_id);
    if (p.ch === 'whatsapp') {
      const rows = (await all(() => { let x = sb.from('contacts').select('*, imports(name), accounts(name)').order('id'); return imp ? x.eq('import_id', imp) : x; }))
        .map(c => ({ ...c, telefono: '+' + c.phone, lista: c.imports?.name, cuenta: c.accounts?.name, primer_mensaje: fmtDate(c.greeting_at), respondio: fmtDate(c.replied_at), reunion: fmtDate(c.meeting_at) }));
      return { filename: `whatsapp-${day}.csv`, csv: csv(rows, ['telefono', 'name', 'rubro', 'city', 'stage', 'lista', 'cuenta', 'primer_mensaje', 'respondio', 'reunion', 'notes', 'tags', 'extra']) };
    }
    if (p.ch === 'instagram') {
      const rows = (await all(() => { let x = sb.from('ig_leads').select('*, imports(name), ig_accounts(name)').order('id'); return imp ? x.eq('import_id', imp) : x; }))
        .map(l => ({ ...l, usuario: '@' + l.username, lista: l.imports?.name, cuenta: l.ig_accounts?.name, primer_contacto: fmtDate(l.first_contact_at), respondio: fmtDate(l.replied_at), reunion: fmtDate(l.meeting_at) }));
      return { filename: `instagram-${day}.csv`, csv: csv(rows, ['usuario', 'link', 'name', 'followers', 'rubro', 'status', 'reason', 'lista', 'cuenta', 'primer_contacto', 'respondio', 'reunion', 'notes']) };
    }
    if (p.ch === 'edition') {
      const lang = m => (m === 'us' ? 'en' : 'es');
      const ST = Object.fromEntries(L.WA_STAGES.map(s => [s.id, s.label])), IGS = Object.fromEntries(L.IG_STATUSES.map(s => [s.id, s.label]));
      const pick = (ex, re) => Object.entries(ex || {}).find(([k, v]) => re.test(k) && v)?.[1] || '';
      const wa = (await all(() => sb.from('contacts').select('*').or('replied_at.not.is.null,stage.in.(interesado,reunion,ganado)').order('id'))).map(c => ({
        email: /@/.test(pick(c.extra, /mail/i)) ? pick(c.extra, /mail/i) : '', nombre: L.personName(c.name) || c.name, canal: c.name, link: pick(c.extra, /(web|sitio|site|url)/i),
        nicho: c.rubro, idioma: lang(c.market), notas: [`WhatsApp · ${ST[c.stage] || c.stage}`, c.notes].filter(Boolean).join(' · '),
        telefono: '+' + c.phone, instagram: '', etapa: ST[c.stage] || c.stage, fecha_reunion: fmtDate(c.meeting_at) }));
      const ig = (await all(() => sb.from('ig_leads').select('*').or('replied_at.not.is.null,status.in.(en_conversacion,reunion,cerrado)').order('id'))).map(l => ({
        email: /@/.test(pick(l.extra, /mail/i)) ? pick(l.extra, /mail/i) : '', nombre: l.name || '@' + l.username, canal: l.name || '@' + l.username, link: l.link, nicho: l.rubro,
        idioma: lang(l.market), notas: [`Instagram · ${IGS[l.status] || l.status}`, l.followers ? `${l.followers} seguidores` : '', l.notes].filter(Boolean).join(' · '),
        telefono: '', instagram: '@' + l.username, etapa: IGS[l.status] || l.status, fecha_reunion: fmtDate(l.meeting_at) }));
      return { filename: `para-app-EDITION-${day}.csv`, csv: csv([...wa, ...ig], ['email', 'nombre', 'canal', 'link', 'nicho', 'idioma', 'notas', 'telefono', 'instagram', 'etapa', 'fecha_reunion']) };
    }
    throw fail(404, 'Canal desconocido.');
  });

  async function api(method, url, body) {
    const [path, qs] = url.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (m) return r.fn(m.groups || {}, body || {}, q);
    }
    throw fail(404, 'Acción desconocida: ' + method + ' ' + path);
  }
  return { api, ensureSeed, getSettings };
}
