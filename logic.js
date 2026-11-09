// Reglas del CRM EDITION (sin base de datos): las usa el navegador y las pruebas.
export const DAY = 86400000;
export const now = () => Date.now();

export const DEFAULT_SETTINGS = {
  country_code: '57', min_delay_sec: '90', max_delay_sec: '240', work_start: '09:30', work_end: '19:00',
  work_days: '1,2,3,4,5,6', seq_days: '2,3,4,7,14', fu_no_days: '30', wa_active_account: '', ig_active_account: '',
  meeting_push_hours: '24', auto_classify: '1', calendly_url: '',
};

// =================== 4.1 Números (varios países) ===================
// Largo del número nacional por código de país.
const NATIONAL = { '57': 10, '52': 10, '34': 9, '1': 10, '54': 10 };

function countryOf(intl) {
  for (const cc of ['1', '34', '52', '54', '57']) if (intl.startsWith(cc)) return cc;
  return null;
}

function applyLocalRules(intl) {
  const cc = countryOf(intl);
  if (!cc) return intl;
  let rest = intl.slice(cc.length);
  if (cc === '54') {
    rest = rest.replace(/^0+/, '');
    if (rest.startsWith('9') && rest.length === 11) return '549' + rest.slice(1);
    // quitar el 15 de los celulares locales: área (2-4 dígitos) + 15 + número
    if (rest.length === 12) {
      for (const a of [2, 3, 4]) {
        if (rest.substr(a, 2) === '15') { rest = rest.slice(0, a) + rest.slice(a + 2); break; }
      }
    }
    if (rest.length === 10) return '549' + rest;
    return '54' + rest;
  }
  if (cc === '52') {
    rest = rest.replace(/^0+/, '');
    if (rest.length === 11 && rest.startsWith('1')) rest = rest.slice(1); // 521 antiguo
    return '52' + rest;
  }
  if (cc === '57') {
    rest = rest.replace(/^0+/, '');
    return '57' + rest;
  }
  return intl;
}

/** Devuelve el número en formato internacional sin "+", o null si no es válido. */
export function normalizePhone(raw, cc = '57') {
  if (raw === null || raw === undefined) return null;
  cc = String(cc || '57').replace(/\D/g, '') || '57';
  let s = String(raw).trim();
  if (!s) return null;
  // números guardados como texto científico (5.49351E+12) no se pueden recuperar
  if (/\d[.,]?\d*e\+?\d+/i.test(s)) return null;
  s = s.replace(/[^\d+]/g, '');
  let intl;
  if (s.startsWith('+')) intl = s.slice(1).replace(/\+/g, '');
  else if (s.startsWith('00')) intl = s.slice(2);
  else {
    let d = s.replace(/\+/g, '');
    const nat = NATIONAL[cc];
    if (nat && d.length === nat) intl = cc + d;
    else if (d.startsWith(cc) && (!nat || d.length > nat)) intl = d;
    else { d = d.replace(/^0+/, ''); intl = d.startsWith(cc) && nat && d.length > nat ? d : cc + d; }
  }
  intl = intl.replace(/\D/g, '');
  intl = applyLocalRules(intl);
  if (intl.length < 10 || intl.length > 15) return null;
  return intl;
}

export function prettyPhone(p) {
  if (!p) return '';
  const cc = countryOf(p);
  if (!cc) return '+' + p;
  const r = p.slice(cc.length);
  if (r.length === 10) return `+${cc} ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
  if (r.length === 9) return `+${cc} ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
  return `+${cc} ${r}`;
}

// =================== 4.2 Plantillas ===================
export function spintax(text) {
  let s = String(text ?? ''), i = 0;
  const re = /\{([^{}]*\|[^{}]*)\}/;          // solo grupos con "|" (no toca {{variables}})
  while (re.test(s) && i++ < 50) {
    s = s.replace(re, (_, g) => { const o = g.split('|'); return o[Math.floor(Math.random() * o.length)]; });
  }
  return s;
}

const BUSINESS_WORDS = [
  'clinica', 'clínica', 'inmobiliaria', 'concesionaria', 'consultorio', 'centro', 'estudio', 'instituto',
  'odontologia', 'odontología', 'dental', 'estetica', 'estética', 'automotor', 'autos', 'motors', 'propiedades',
  'sanatorio', 'veterinaria', 'agencia', 'grupo',
  // rubros de EDITION
  'spa', 'medspa', 'dermatologia', 'dermatología', 'cirugia', 'cirugía', 'laser', 'láser', 'belleza', 'beauty',
  'podcast', 'studio', 'studios', 'media', 'marketing', 'digital', 'tienda', 'store', 'shop', 'boutique', 'moda',
  'academia', 'academy', 'escuela', 'coaching', 'consultora', 'consulting', 'films', 'producciones', 'productora',
  'comunicaciones', 'publicidad', 'creativa', 'creative', 'social', 'ecommerce', 'e-commerce', 'oficial',
  'clinic', 'agency', 'center', 'centre', 'group', 'llc', 'inc', 'ltd', 'corp', 'company', 'co.', 'sas', 's.a.s',
  'salon', 'salón', 'barberia', 'barbería', 'gym', 'fitness', 'nutricion', 'nutrición', 'medical', 'health',
  'wellness', 'hospital', 'ips', 'laboratorio', 'lab', 'institute', 'aesthetics', 'dentistry', 'realty',
];
export function personName(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  const low = n.toLowerCase();
  if (/\d/.test(n)) return '';
  if (/\bs\.?\s?a\.?\b|\bs\.?r\.?l\.?\b|\bsas\b/i.test(n)) return '';
  const words = low.split(/[\s|·\-–—,/()]+/).filter(Boolean);
  if (words.length > 3) return '';
  if (words.some(w => BUSINESS_WORDS.includes(w.replace(/[.,!¡?¿]/g, '')) || BUSINESS_WORDS.includes(w))) return '';
  if (/[&@|]/.test(n)) return '';
  const first = n.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '');
  if (!first || first.length < 2) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const RUBRO_EN = {
  'coaches y mentores': 'coaches and mentors', 'creadores y podcasts': 'creators and podcasters',
  'clínicas y estética': 'clinics and aesthetic practices', 'clinicas y estetica': 'clinics and aesthetic practices',
  'e-commerce y agencias': 'e-commerce brands and agencies',
};

export function renderTemplate(body, c = {}, market = 'co_mx') {
  const nombre = personName(c.name);
  let rubro = String(c.rubro || '').trim().toLowerCase();
  if (market === 'us') rubro = RUBRO_EN[rubro] || (rubro && !/[áéíóúñ]/.test(rubro) ? rubro : '');
  if (!rubro) rubro = market === 'us' ? 'businesses like yours' : 'negocios como el tuyo';
  const settings = c._settings || {};
  let s = spintax(body);
  s = s.replace(/\{\{\s*nombre_coma\s*\}\}/g, nombre ? `, ${nombre}` : '')
    .replace(/\{\{\s*nombre\s*\}\}/g, nombre)
    .replace(/\{\{\s*negocio\s*\}\}/g, String(c.name || c.company || '').trim())
    .replace(/\{\{\s*rubro\s*\}\}/g, rubro)
    .replace(/\{\{\s*ciudad\s*\}\}/g, String(c.city || '').trim())
    .replace(/\{\{\s*link_reunion\s*\}\}/g, settings.calendly_url || '');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/^[ \t]+|[ \t]+$/gm, '').trim();
  // mayúscula inicial (después de ¿ ¡)
  s = s.replace(/^([¿¡"“]*)(\p{Ll})/u, (_, p, l) => p + l.toUpperCase());
  return s;
}

// =================== 4.3 Clasificar respuestas ===================
const NEG = /(no me interesa|no nos interesa|no estoy interesad|no gracias|no, gracias|por ahora no|ahora no|ya tenemos|ya tengo (editor|quien|alguien)|ya trabajamos con|ya contamos con|no molest|borrame|bórrame|elimin(a|á)me|spam|no me escrib|dej(a|á) de escribir|not interested|no thanks|no thank you|stop|unsubscribe|remove me|we already have)/i;
const POS = /(me interesa|nos interesa|interesad[oa]|contame|cuéntame|cuentame|pasame info|pásame info|p(a|á)same m(a|á)s|m(a|á)s info|cu(a|á)nto (sale|cuesta|vale|cobran)|precio|tarifa|cotiza|reuni(o|ó)n|llamada|agend|de qu(e|é) se trata|c(o|ó)mo funciona|me gustar(i|í)a|dale|s(i|í), claro|claro que s(i|í)|ok,? cu(e|é)ntame|interested|how much|price|pricing|call|tell me more|sounds good|let'?s talk)/i;

export function classify(text) {
  const t = String(text || '');
  const tags = [];
  if (/(precio|cu(a|á)nto (sale|cuesta|vale|cobran)|tarifa|cotiza|how much|price|pricing|cost)/i.test(t)) tags.push('pide precio');
  if (/(qui(e|é)n sos|qui(e|é)n eres|qui(e|é)n es|de d(o|ó)nde (sac|tien)|c(o|ó)mo conseguiste|qui(e|é)n habla|who is this|who are you)/i.test(t)) tags.push('pregunta quién sos');
  const negative = NEG.test(t);
  const positive = !negative && POS.test(t);
  return { negative, positive, tags };
}

// =================== 4.4 Etapas ===================
export const WA_STAGES = [
  { id: 'por_contactar', label: 'Por contactar' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'respondio', label: 'Respondió' },
  { id: 'pitch_enviado', label: 'Pitch enviado' },
  { id: 'interesado', label: 'Interesado' },
  { id: 'no_interesado', label: 'No interesado' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'ganado', label: 'Ganado' },
  { id: 'perdido', label: 'Perdido' },
];
export const IG_STATUSES = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'respondio', label: 'Respondió' },
  { id: 'en_conversacion', label: 'En conversación' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'cerrado', label: 'Cerrado' },
  { id: 'descartado', label: 'Descartado' },
];



export const MILESTONES = [
  ['respondio', 'replied_at'], ['pitch_enviado', 'pitch_at'], ['interesado', 'interested_at'],
  ['reunion', 'meeting_set_at'], ['ganado', 'won_at'],
];

// Elegir plantilla: mercado + rubro exacto → mercado general → español neutro
export function pickTemplate(templates, kind, rubro = '', channel = 'whatsapp', market = 'co_mx', excludeId = null) {
  const r = String(rubro || '').trim().toLowerCase();
  const all = templates.filter(t => t.kind === kind && t.channel === channel);
  const markets = [market || 'co_mx']; if (!markets.includes('co_mx')) markets.push('co_mx');
  for (const m of markets) {
    const inMarket = all.filter(t => (t.market || 'co_mx') === m);
    const exact = r ? inMarket.filter(t => (t.rubro || '').trim().toLowerCase() === r) : [];
    let pool = exact.length ? exact : inMarket.filter(t => !(t.rubro || '').trim());
    if (excludeId && pool.length > 1) pool = pool.filter(t => t.id !== excludeId);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}
export function buildMessage(templates, settings, kind, c, channel = 'whatsapp', excludeId = null) {
  const market = c.market || 'co_mx';
  let t = pickTemplate(templates, kind, c.rubro, channel, market, excludeId);
  if (!t && kind === 'seg1_saludo') t = pickTemplate(templates, 'seg1', c.rubro, channel, market, excludeId);
  if (!t) return { template_id: null, body: '' };
  return { template_id: t.id, body: renderTemplate(t.body, { ...c, _settings: settings }, market) };
}

/** Cambio de etapa: devuelve los campos a actualizar (o null si no cambia nada). */
export function stagePatch(c, stage, force = false, t = now()) {
  if (!WA_STAGES.some(s => s.id === stage)) throw new Error('Etapa desconocida');
  if (c.stage === stage && !force) return null;
  const p = { stage, stage_changed_at: t, fu_count: 0, snooze_until: null };
  const idx = MILESTONES.findIndex(m => m[0] === stage);
  if (idx >= 0) for (let i = 0; i <= idx; i++) { const f = MILESTONES[i][1]; p[f] = c[f] ?? t; }
  if (stage === 'contactado') p.greeting_at = c.greeting_at ?? t;
  return p;
}

/** Respuesta del lead (la pegas o tocas "Respondió"): marca la respuesta, corta la secuencia y mueve la etapa. */
export function incomingPatch(c, text, settings, t = now()) {
  const { negative, positive, tags } = classify(text || '');
  const p = { last_in_at: Math.max(c.last_in_at || 0, t) };
  // un "no" que vuelve a decir que no conserva su seguimiento único
  if (c.stage !== 'no_interesado') p.fu_count = 0;
  const cur = new Set(Array.isArray(c.tags) ? c.tags : []);
  tags.forEach(x => cur.add(x)); p.tags = [...cur];
  const auto = settings.auto_classify === '1';
  let next = null;
  if (auto && text) {
    if (['por_contactar', 'contactado'].includes(c.stage)) next = negative ? 'no_interesado' : 'respondio';
    else if (c.stage === 'pitch_enviado') next = negative ? 'no_interesado' : positive ? 'interesado' : null;
    else if (c.stage === 'no_interesado' && positive) next = 'interesado';
    else if (c.stage === 'perdido') next = 'respondio';
  } else if (['por_contactar', 'contactado', 'perdido'].includes(c.stage)) next = 'respondio';
  if (next) Object.assign(p, stagePatch({ ...c, ...p }, next, false, t) || {});
  if (c.greeting_at || p.greeting_at) p.replied_at = c.replied_at ?? p.replied_at ?? t;
  return p;
}

// =================== 4.5 Secuencia de seguimientos ===================
export function seqDays(settings = DEFAULT_SETTINGS) {
  const arr = String(settings.seq_days || '').split(',').map(x => parseInt(x, 10)).filter(n => Number.isFinite(n) && n >= 0);
  const base = arr.length ? arr : [2, 3, 4, 7, 14];
  while (base.length < 5) base.push(base[base.length - 1]);
  return base.slice(0, 5);
}
export function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }

/** Próximo paso (1–5) que toca, o null. Cuenta días de calendario. */
export function dueStep(fu_count, last_out_at, settings = DEFAULT_SETTINGS, t = now()) {
  if (!last_out_at) return null;
  const step = (fu_count || 0) + 1;
  if (step > 5) return null;
  const days = seqDays(settings)[step - 1];
  return t >= addDays(startOfDay(last_out_at), days) ? step : null;
}
export function followupKind(c, step) {
  if (step === 1 && c.stage === 'contactado') return 'seg1_saludo';
  return 'seg' + step;
}

// =================== 4.6 Tareas del día (WhatsApp) ===================
// Sin lectura automática de WhatsApp: "Te escribieron" son los que marcaste como respuesta y todavía no contestaste.
export function todayTasks(contacts, settings = DEFAULT_SETTINGS, t = now()) {
  const pushMs = (parseFloat(settings.meeting_push_hours) || 24) * 3600000;
  const noDays = Math.max(1, parseInt(settings.fu_no_days, 10) || 30);
  const g = { escribieron: [], pitch: [], seguimiento: [], reunion_push: [], reuniones: [], retomar_no: [], cerrar: [] };
  for (const c0 of contacts) {
    if (c0.stage === 'por_contactar' || c0.stage === 'ganado') continue;
    if (c0.snooze_until && c0.snooze_until > t) continue;
    const c = { ...c0 };
    const lastIn = c.last_in_at || 0, lastOut = c.last_out_at || 0;
    const theyWroteLast = lastIn > lastOut;
    if (c.stage === 'reunion') {
      if (c.meeting_at && c.meeting_at <= t + 48 * 3600000 && c.meeting_at >= t - 3 * 3600000) g.reuniones.push(c);
      else if (theyWroteLast) g.escribieron.push(c);
      continue;
    }
    if (c.stage === 'perdido') { if (theyWroteLast) g.escribieron.push(c); continue; }
    if (c.stage === 'respondio') { g.pitch.push(c); continue; }
    if (c.stage === 'interesado') {
      if (!c.meeting_at && (theyWroteLast || t - Math.max(lastIn, lastOut, c.stage_changed_at || 0) >= pushMs)) g.reunion_push.push(c);
      continue;
    }
    if (c.stage === 'no_interesado') {
      if (theyWroteLast) { g.escribieron.push(c); continue; }
      const base = Math.max(c.stage_changed_at || 0, lastIn, lastOut) || t;
      if ((c.fu_count || 0) === 0 && t >= addDays(startOfDay(base), noDays)) g.retomar_no.push(c);
      continue;
    }
    if (theyWroteLast) { g.escribieron.push(c); continue; }
    if (c.stage === 'contactado' || c.stage === 'pitch_enviado') {
      if (c.stage === 'pitch_enviado' && c.pitch_at && lastIn > c.pitch_at) continue; // charla abierta
      const step = dueStep(c.fu_count, lastOut, settings, t);
      if (step) { c.step = step; c.followup_kind = followupKind(c, step); g.seguimiento.push(c); continue; }
      if ((c.fu_count || 0) >= 5 && t >= addDays(startOfDay(lastOut), 7)) g.cerrar.push(c);
    }
  }
  g.seguimiento.sort((a, b) => a.step - b.step || (a.last_out_at - b.last_out_at));
  g.escribieron.sort((a, b) => b.last_in_at - a.last_in_at);
  g.reuniones.sort((a, b) => a.meeting_at - b.meeting_at);
  return g;
}

// =================== 4.7 Seguimientos de Instagram ===================
export function igFollowups(leads, settings = DEFAULT_SETTINGS, t = now()) {
  const out = [];
  for (const l0 of leads) {
    if (l0.status !== 'contactado' || (l0.snooze_until && l0.snooze_until > t)) continue;
    const step = dueStep(l0.fu_count, l0.last_contact_at, settings, t);
    if (step) out.push({ ...l0, step });
  }
  return out.sort((a, b) => a.step - b.step || a.last_contact_at - b.last_contact_at);
}

/** Cambio de estado de Instagram: completa fechas para que cuente en métricas y seguimientos. */
export function igStatusPatch(l, status, t = now()) {
  if (!l || l.status === status) return null;
  const p = { status, status_changed_at: t };
  const order = ['contactado', 'respondio', 'en_conversacion', 'reunion', 'cerrado'];
  const idx = order.indexOf(status);
  if (idx >= 0) { p.first_contact_at = l.first_contact_at ?? t; p.last_contact_at = l.last_contact_at ?? t; }
  if (idx >= 1) { p.replied_at = l.replied_at ?? t; p.fu_count = 0; }
  if (status === 'contactado' && l.status !== 'contactado') p.fu_count = 0;
  return p;
}

// =================== Horario ===================
export function inWorkHours(settings = DEFAULT_SETTINGS, t = now()) {
  const d = new Date(t);
  const days = String(settings.work_days || '').split(',').map(Number);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const [sh, sm] = String(settings.work_start || '09:30').split(':').map(Number);
  const [eh, em] = String(settings.work_end || '19:00').split(':').map(Number);
  const mins = d.getHours() * 60 + d.getMinutes();
  return days.includes(dow) && mins >= sh * 60 + sm && mins < eh * 60 + em;
}

// =================== Instagram: usuario desde link ===================
export function extractIgUser(v) {
  let s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@+/, '').replace(/[/?#].*$/, '').trim().toLowerCase();
  if (['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts'].includes(s)) return null;
  if (!/^[a-z0-9._]{1,30}$/.test(s)) return null;
  return s;
}
export function parseFollowers(v) {
  let s = String(v ?? '').trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  let mult = 1;
  if (/(k|mil)$/.test(s)) { mult = 1000; s = s.replace(/(k|mil)$/, ''); }
  else if (/(m|mm|millones?)$/.test(s)) { mult = 1e6; s = s.replace(/(m|mm|millones?)$/, ''); }
  if (mult > 1) s = s.replace(',', '.'); else s = s.replace(/[.,]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

/** Enlace de WhatsApp con el mensaje ya escrito (abre la app en el celular o WhatsApp en la PC). */
export function waLink(phone, text) {
  return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(text || '')}`;
}
