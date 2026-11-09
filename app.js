// Panel del CRM EDITION (versión en la nube): una sola página, rutas por hash y una función por pantalla en VIEWS.
// Los datos viven en Supabase; data.js traduce cada acción a consultas con la sesión de la usuaria.
import { createData, META } from './data.js';
import { waLink } from './logic.js';

const App = (() => {
  // =================== Utilidades ===================
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = { meta: null, settings: {}, counters: {}, igAccounts: [], waAccounts: [] };
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
  const fmtDateTime = ts => ts ? `${fmtDate(ts)} · ${fmtTime(ts)}` : '';
  const sod = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function dayLabel(ts) {
    const d = sod(ts), t = sod();
    if (d === t) return 'Hoy';
    if (d === t + DAY) return 'Mañana';
    if (d === t - DAY) return 'Ayer';
    return new Date(ts).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function rel(ts) {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24 && sod(ts) === sod()) return `hace ${h} h`;
    const d = Math.round((sod() - sod(ts)) / DAY);
    return d <= 1 ? 'ayer' : `hace ${d} días`;
  }
  const initials = s => (String(s || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
  const mmss = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromLocalInput = v => (v ? new Date(v).getTime() : null);
  const stageLabel = id => state.meta?.stages.find(s => s.id === id)?.label || id;
  const igLabel = id => state.meta?.ig_statuses.find(s => s.id === id)?.label || id;
  const marketLabel = id => ({ co_mx: 'CO/MX', es: 'España', us: 'EE. UU.' }[id] || esc(id));
  const RUBROS = ['Coaches y mentores', 'Creadores y podcasts', 'Clínicas y estética', 'E-commerce y agencias'];

  function gcalUrl(title, start, details = '') {
    const f = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(start + 30 * 60000)}&details=${encodeURIComponent(details)}`;
  }
  function openExternal(url) { window.open(url, '_blank', 'noopener'); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const r = document.execCommand('copy'); t.remove(); return r; } catch { return false; }
    }
  }
  const isMobile = () => matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  function openWhatsApp(phone, text) { window.open(waLink(phone, text), '_blank', 'noopener'); }
  function openInstagram(url) { window.open(url, '_blank', 'noopener'); }
  async function downloadExport(path) {
    const r = await GET('/export/' + path);
    const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Archivo descargado ✓', 'ok');
  }

  // =================== API ===================
  let DATA = null;
  async function api(method, url, body, { quiet = false } = {}) {
    try {
      return await DATA.api(method, url.replace(/[?&]read=1/, ''), body);
    } catch (e) {
      if (e.status === 401) { showLogin('Tu sesión venció. Vuelve a entrar.'); }
      if (!quiet) toast(e.message || 'Algo salió mal. Intenta de nuevo.', 'bad');
      throw e;
    }
  }
  const GET = (u, o) => api('GET', u, undefined, o);
  const POST = (u, b, o) => api('POST', u, b ?? {}, o);
  const PATCH = (u, b, o) => api('PATCH', u, b ?? {}, o);
  const DEL = (u, o) => api('DELETE', u, undefined, o);

  // =================== Avisos y modales ===================
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), type === 'bad' ? 6000 : 3500);
  }
  function modal(html, { wide = false, onClose } = {}) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); document.removeEventListener('keydown', key); onClose?.(); };
    const key = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    $$('[data-close]', bg).forEach(b => (b.onclick = close));
    return { el: bg.firstElementChild, close };
  }
  function confirmBox(text, okLabel = 'Sí', danger = false) {
    return new Promise(res => {
      const m = modal(`<h2>${esc(text)}</h2><div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? 'bad' : 'primary'}" id="cb-ok">${esc(okLabel)}</button></div>`,
        { onClose: () => res(false) });
      $('#cb-ok', m.el).onclick = () => { res(true); m.close(); };
    });
  }
  function emptyState(icon, title, text, btnLabel, href) {
    return `<div class="empty"><div class="ic">${icon}</div><b>${esc(title)}</b><p>${esc(text)}</p>${btnLabel ? `<a class="btn primary" href="${href}">${esc(btnLabel)}</a>` : ''}</div>`;
  }

  // =================== Contadores de la barra lateral ===================
  let ctrTimer = null;
  function refreshCounters() {
    clearTimeout(ctrTimer);
    ctrTimer = setTimeout(async () => {
      try {
        const c = await GET('/counters', { quiet: true });
        state.counters = c;
        $('#b-wa').textContent = c.wa_pending || '';
        $('#b-chat').textContent = c.wa_unread || '';
        $$('[data-badge]').forEach(b => { b.textContent = c[b.dataset.badge] || ''; });
        $('#b-ig').textContent = c.ig_pending || '';
      } catch {}
      CUR.onCounters?.();
    }, 250);
  }

  // =================== Rutas ===================
  let CUR = { cleanup: [] };
  const VIEWS = {};
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || 'hoy';
    const [p, q] = h.split('?');
    const [view, sub] = p.split('/');
    return { view, sub, params: Object.fromEntries(new URLSearchParams(q || '')) };
  }
  async function route() {
    const { view, sub, params } = parseHash();
    CUR.cleanup.forEach(fn => { try { fn(); } catch {} });
    CUR = { cleanup: [], view, sub };
    $$('.nav').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    const main = $('#main');
    main.scrollTop = 0;
    const el = document.createElement('div');
    el.className = 'view';
    main.replaceChildren(el);
    const fn = VIEWS[view] || VIEWS.hoy;
    try {
      await fn(el, sub, params);
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="glass pad-l" style="max-width:560px;margin:60px auto;text-align:center">
        <div style="font-size:34px">⚠️</div><h2>No se pudo cargar esta pantalla</h2>
        <p class="mut">${esc(e.message || 'Error inesperado')}</p><button class="btn primary" id="retry">Reintentar</button></div>`;
      $('#retry', el).onclick = route;
    }
  }
  const go = h => { if (location.hash === h) route(); else location.hash = h; };

  // =================== Eventos en vivo (SSE) ===================
  function startEvents() {
    // Sin servidor propio: los datos se refrescan al volver a la app y cada minuto (así ves lo que hiciste en el otro dispositivo).
    let last = 0;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 20000) return;
      last = Date.now(); refreshCounters(); CUR.onRemote?.();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    setInterval(() => { if (document.visibilityState === 'visible') refreshCounters(); }, 60000);
  }

  // =================== Componentes compartidos ===================
  function quotaBar(sent, cap) {
    const n = Math.max(1, Math.min(cap || 1, 60));
    const filled = Math.round(Math.min(sent, cap) / (cap || 1) * n);
    return `<div class="seg" style="grid-template-columns:repeat(${n},1fr)">${Array.from({ length: n }, (_, i) => `<i class="${i < filled ? 'f' : ''}"></i>`).join('')}</div>`;
  }
  const waDot = s => s === 'conectado' ? 'ok' : (s === 'qr' || s === 'conectando') ? 'warn' : 'bad';
  const waStatusLabel = s => ({ conectado: 'conectada', qr: 'esperando QR', conectando: 'conectando…', desconectado: 'desconectada' }[s] || s);

  function extraChips(extra) {
    const out = [];
    for (const [k, v] of Object.entries(extra || {})) {
      const s = String(v ?? '').trim(); if (!s) continue;
      if (/^https?:\/\//i.test(s)) {
        const label = /google\.[^/]+\/maps|maps\.app|goo\.gl\/maps/i.test(s) ? '📍 Ver en Maps' : s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        out.push(`<a class="chip" href="#" data-ext="${esc(s)}" title="${esc(k)}">${esc(label)}</a>`);
      } else out.push(`<span class="chip" title="${esc(k)}">${/rating|calific|estrell/i.test(k) ? '★ ' : ''}${esc(s)}</span>`);
    }
    return out.join('');
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ext]');
    if (a) { e.preventDefault(); openExternal(a.dataset.ext); }
    const x = e.target.closest('[data-export]');
    if (x) { e.preventDefault(); downloadExport(x.dataset.export).catch(() => {}); }
  });

  function meetingModal(current, title, onSave) {
    const m = modal(`<h2>Agendar reunión</h2><p class="mut">${esc(title)}</p>
      <label class="f">Fecha y hora<input type="datetime-local" id="mt" value="${toLocalInput(current || (sod() + DAY + 10 * 3600000))}"></label>
      <div class="foot">${current ? '<button class="btn bad" id="mt-del">Quitar reunión</button><span class="spacer"></span>' : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="mt-ok">Guardar</button></div>`);
    $('#mt-ok', m.el).onclick = async () => {
      const ts = fromLocalInput($('#mt', m.el).value);
      if (!ts) return toast('Elige fecha y hora.', 'warn');
      await onSave(ts); m.close();
      const ok = await confirmBox('¿Agregar la reunión a Google Calendar?', '📅 Agregar a Google Calendar');
      if (ok) openExternal(gcalUrl(`Reunión EDITION · ${title}`, ts, 'Agendada desde el CRM EDITION'));
    };
    const del = $('#mt-del', m.el);
    if (del) del.onclick = async () => { await onSave(null); m.close(); };
  }

  // Panel de conversación de WhatsApp (seguimiento y conversaciones)
  async function chatPanel(el, contactId, { suggest = null, onChange } = {}) {
    CUR.openContact = contactId;
    let c = await GET(`/contacts/${contactId}`);
    let msgs = await GET(`/contacts/${contactId}/messages`);
    let kind = suggest || (c.stage === 'respondio' ? 'pitch' : c.stage === 'interesado' ? 'reunion' : 'manual');
    let tplId = null, opened = false;
    const kinds = { pitch: 'Pitch', reunion: 'Llevar a la reunión', seguimiento: 'Seguimiento', seguimiento_no: 'Seguimiento a un "no"', manual: 'Mensaje libre' };

    function bubbles() {
      if (!msgs.length) return '<div class="chat-empty">Todavía no hay mensajes registrados con este contacto.</div>';
      return msgs.map(m => `<div class="bubble ${m.direction}">${esc(m.body)}<span class="meta">${fmtDateTime(m.ts)}${m.direction === 'out' && m.account_name ? ' · ' + esc(m.account_name) : ''}${m.kind && m.kind !== 'manual' ? ' · ' + esc(m.kind) : ''}</span></div>`).join('');
    }
    function render() {
      const tags = (c.tags || []).map(t => `<span class="chip k">${esc(t)}</span>`).join('');
      el.innerHTML = `
        <div class="glass pad-l">
          <div class="lead-top">
            <div class="av">${esc(initials(c.name))}</div>
            <div style="min-width:0"><h2 style="margin:0">${esc(c.name || c.phone_pretty)}</h2>
              <div class="mut mono">${esc(c.phone_pretty)}</div></div>
            <div class="lead-side">${esc(c.account_name || 'Sin cuenta')}<b>${esc(stageLabel(c.stage))}</b>${c.meeting_at ? `<span class="acc-t">📅 ${fmtDateTime(c.meeting_at)}</span>` : ''}</div>
          </div>
          <div class="chips" style="margin:12px 0">${c.rubro ? `<span class="chip k">${esc(c.rubro)}</span>` : ''}${c.import_name ? `<span class="chip">Lista: ${esc(c.import_name)}</span>` : ''}${tags}${extraChips(c.extra)}</div>
          <div class="lab" style="margin:4px 0 8px">Etapa · un clic para cambiar</div>
          <div class="stage-btns" id="stg">${state.meta.stages.map(s => `<button data-s="${s.id}" class="${s.id === c.stage ? 'on' : ''}">${esc(s.label)}</button>`).join('')}</div>
          <div class="chat" id="chat" style="margin-top:16px">${bubbles()}</div>
          <div class="reply-box">
            <div class="lab" style="margin-bottom:6px">¿Te respondió? Pega lo que te dijo (opcional)</div>
            <div class="row"><input type="text" id="reply" placeholder="Ej.: Me interesa, ¿cuánto cuesta?" style="flex:1;min-width:180px"><button class="btn okb" id="rep">Respondió</button></div>
            <div class="tiny mut" style="margin-top:4px">La etapa se mueve sola según lo que diga y se corta la secuencia de seguimientos.</div>
          </div>
          <div class="row" style="margin:16px 0 8px">
            <span class="lab">Mensaje:</span>
            <div class="subtabs scroll-x" id="kinds">${Object.entries(kinds).map(([k, l]) => `<button data-k="${k}" class="${k === kind ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
          </div>
          <textarea class="msg" id="txt" placeholder="Escribe tu mensaje…"></textarea>
          <div class="hint" id="hint"></div>
          <div class="actions">
            <button class="btn primary big" id="open">Abrir WhatsApp</button>
            <button class="btn okb big" id="sent" disabled>Enviado ✓</button>
            <button class="btn" id="var">↻ Otra variante</button>
            ${kind === 'reunion' && state.settings.calendly_url ? '<button class="btn" id="cal">🔗 Insertar mi link de agenda</button>' : ''}
            <span class="spacer"></span>
            <button class="btn ghost" id="meet">📅 Agendar reunión</button>
            <button class="btn ghost" id="later">Después ▾</button>
            <button class="btn bad" id="nos">No sirve</button>
          </div>
          <details style="margin-top:18px"><summary class="mut small" style="cursor:pointer">Notas y etiquetas</summary>
            <div class="col" style="margin-top:10px">
              <textarea id="notes" rows="3" placeholder="Notas sobre este lead">${esc(c.notes || '')}</textarea>
              <input type="text" id="tags" placeholder="Etiquetas separadas por coma" value="${esc((c.tags || []).join(', '))}">
              <div><button class="btn sm" id="save-notes">Guardar notas</button></div>
            </div>
          </details>
        </div>`;
      const chat = $('#chat', el); chat.scrollTop = chat.scrollHeight;
      bind();
    }
    async function loadSuggestion(exclude) {
      const txt = $('#txt', el);
      opened = false; if ($('#sent', el)) $('#sent', el).disabled = true;
      if (kind === 'manual') { tplId = null; $('#hint', el).textContent = 'Mensaje libre: no cambia la etapa (salvo que esté "Por contactar").'; return; }
      try {
        const r = await GET(`/contacts/${contactId}/render?kind=${kind}${exclude ? '&exclude=' + exclude : ''}`);
        tplId = r.template_id; txt.value = r.body || '';
        const step = Math.min(5, (c.fu_count || 0) + 1);
        $('#hint', el).textContent = kind === 'pitch' ? 'Al marcar "Enviado", pasa a "Pitch enviado" y arranca la secuencia de seguimientos.'
          : kind === 'seguimiento' ? `Seguimiento ${step}/5.` : kind === 'seguimiento_no' ? 'Un solo mensaje para retomar a alguien que dijo que no.'
          : kind === 'reunion' ? 'Propón la llamada de 15 minutos.' : '';
      } catch {}
    }
    function bind() {
      $('#stg', el).onclick = async (e) => {
        const s = e.target.closest('button')?.dataset.s; if (!s || s === c.stage) return;
        if (s === 'reunion') return $('#meet', el).click();
        c = await PATCH(`/contacts/${contactId}`, { stage: s }); toast(`Etapa: ${stageLabel(s)}`, 'ok'); render(); loadSuggestion(); onChange?.();
      };
      $('#kinds', el).onclick = (e) => {
        const k = e.target.closest('button')?.dataset.k; if (!k) return;
        kind = k; render(); loadSuggestion();
      };
      const txt = $('#txt', el), sent = $('#sent', el);
      txt.oninput = () => { opened = false; sent.disabled = true; };
      $('#var', el).onclick = () => loadSuggestion(tplId);
      const cal = $('#cal', el);
      if (cal) cal.onclick = () => { txt.value = txt.value.trim() + `\n${state.settings.calendly_url}`; txt.focus(); };
      $('#open', el).onclick = () => {
        const body = txt.value.trim();
        if (!body) return toast('Escribe un mensaje primero.', 'warn');
        openWhatsApp(c.phone, body); opened = true; sent.disabled = false;
        toast('Envíalo en WhatsApp y vuelve para tocar "Enviado ✓".');
      };
      sent.onclick = async () => {
        if (!opened || sent.disabled) return;
        const body = txt.value.trim();
        sent.disabled = true;
        try {
          c = await POST(`/contacts/${contactId}/sent`, { kind, body, template_id: tplId });
          msgs = await GET(`/contacts/${contactId}/messages`);
          toast('Registrado ✓', 'ok');
          kind = 'manual'; render(); loadSuggestion(); onChange?.();
        } catch { sent.disabled = false; }
      };
      $('#rep', el).onclick = async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          const before = c.stage;
          c = await POST(`/contacts/${contactId}/reply`, { text: $('#reply', el).value.trim() });
          msgs = await GET(`/contacts/${contactId}/messages`);
          toast(before !== c.stage ? `Respuesta registrada · ${stageLabel(c.stage)}` : 'Respuesta registrada ✓', 'ok');
          kind = c.stage === 'respondio' ? 'pitch' : c.stage === 'interesado' ? 'reunion' : 'manual';
          render(); loadSuggestion(); onChange?.();
        } catch { btn.disabled = false; }
      };
      $('#meet', el).onclick = () => meetingModal(c.meeting_at, c.name || c.phone_pretty, async (ts) => {
        c = await PATCH(`/contacts/${contactId}`, { meeting_at: ts }); render(); onChange?.();
      });
      $('#later', el).onclick = () => {
        const m = modal(`<h2>¿Cuándo lo retomas?</h2><p class="mut">Desaparece de la lista hasta ese día.</p>
          <div class="big-stage">${[1, 3, 7].map(d => `<button data-d="${d}">En ${d} día${d > 1 ? 's' : ''}</button>`).join('')}</div>
          <div class="foot"><button class="btn ghost" data-close>Cancelar</button></div>`);
        m.el.onclick = async (ev) => {
          const d = ev.target.closest('button[data-d]')?.dataset.d; if (!d) return;
          await PATCH(`/contacts/${contactId}`, { snooze_days: Number(d) }); m.close(); toast(`Lo verás de nuevo en ${d} día${d > 1 ? 's' : ''}.`); onChange?.('snoozed');
        };
      };
      $('#nos', el).onclick = async () => {
        if (!await confirmBox('¿Marcar este lead como "No sirve"? Pasa a Perdido.', 'Sí, no sirve', true)) return;
        await POST(`/contacts/${contactId}/discard`, { reason: 'no_sirve' }); toast('Marcado como perdido.'); onChange?.('discarded');
      };
      $('#save-notes', el).onclick = async () => {
        c = await PATCH(`/contacts/${contactId}`, { notes: $('#notes', el).value, tags: $('#tags', el).value.split(',').map(s => s.trim()).filter(Boolean) });
        toast('Notas guardadas ✓', 'ok');
      };
    }
    render(); await loadSuggestion();
    return {
      async refresh() { c = await GET(`/contacts/${contactId}`); msgs = await GET(`/contacts/${contactId}/messages`); const t = $('#txt', el)?.value; render(); if (t) $('#txt', el).value = t; },
      id: contactId,
    };
  }

  // =================== Pantalla: Hoy ===================
  VIEWS.hoy = async (el) => {
    const d = await GET('/dashboard');
    const k = d.kpis, wa = d.whatsapp, ig = d.instagram;
    const groups = {};
    for (const m of d.agenda) (groups[sod(m.meeting_at)] ||= []).push(m);
    const hello = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
    el.innerHTML = `
      <div class="head"><div class="grow"><h1>${hello}, Natalia</h1><p class="sub" style="margin:0">Esto es lo que te falta hoy en los dos canales.</p></div></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="glass kpi"><div class="lab">Primeros mensajes hoy</div><div class="v">${k.first_today} <span>/ ${k.first_cap}</span></div><div class="s">WhatsApp + Instagram</div></div>
        <div class="glass kpi"><div class="lab">Seguimientos pendientes</div><div class="v">${k.followups}</div><div class="s">Les toca hoy</div></div>
        <div class="glass kpi"><div class="lab">Respuestas de hoy</div><div class="v">${k.replies_today}</div><div class="s">Personas que te escribieron</div></div>
        <div class="glass kpi"><div class="lab">Reuniones esta semana</div><div class="v">${k.meetings_week}</div><div class="s">Lunes a domingo</div></div>
      </div>
      <div class="grid g2" style="margin-bottom:16px">
        ${channelCard('WhatsApp', '#/whatsapp', wa, [
          ['Primeros mensajes por enviar', wa.left], ['Seguimientos pendientes', wa.followups],
          ['Por responder (te escribieron, pitch, reunión)', wa.to_answer], ['Respuestas de hoy', wa.replies],
          ['Tasa de respuesta (7 días)', `${wa.week_rate} % <span class="mut small">de ${wa.week_sent}</span>`]], wa.accounts ? '' : 'Agrega tu cuenta de WhatsApp para empezar.')}
        ${channelCard('Instagram', '#/instagram', ig, [
          ['Primeros mensajes por enviar', ig.left], ['Seguimientos pendientes', ig.followups], ['Respuestas de hoy', ig.replies],
          ['Tasa de respuesta (7 días)', `${ig.week_rate} % <span class="mut small">de ${ig.week_sent}</span>`]], ig.accounts ? '' : 'Agrega tu cuenta de Instagram para empezar.')}
      </div>
      <div class="glass pad-l">
        <div class="row" style="margin-bottom:10px"><h2 style="margin:0">Agenda</h2><span class="mut small">próximos 30 días</span></div>
        ${d.agenda.length ? Object.entries(groups).map(([day, list]) => `
          <div style="margin:12px 0 4px" class="lab">${esc(dayLabel(Number(day)))}</div>
          <div class="items">${list.map(m => `
            <div class="item" style="cursor:default">
              <b class="mono" style="width:52px">${fmtTime(m.meeting_at)}</b>
              <div class="grow"><div class="t">${esc(m.name || m.phone || m.username)}</div><div class="d">${m.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</div></div>
              <a class="btn sm" href="${m.channel === 'whatsapp' ? `#/whatsapp/chats?c=${m.id}` : `#/instagram/todos?l=${m.id}`}">Abrir</a>
              <button class="btn sm" data-gcal="${m.meeting_at}" data-title="${esc(m.name || m.username || '')}" data-det="${esc(m.channel === 'whatsapp' ? (m.phone ? '+' + m.phone : '') : 'instagram.com/' + (m.username || ''))}">📅 Agregar a Google Calendar</button>
            </div>`).join('')}</div>`).join('') : '<p class="mut">No tienes reuniones agendadas. Cuando un lead acepte, toca "Agendar reunión" en su chat.</p>'}
      </div>`;
    el.onclick = (e) => {
      const b = e.target.closest('[data-gcal]'); if (!b) return;
      openExternal(gcalUrl(`Reunión EDITION · ${b.dataset.title}`, Number(b.dataset.gcal), b.dataset.det));
    };
    function channelCard(name, href, x, rows, warn) {
      const pct = x.cap ? Math.min(100, Math.round(x.sent / x.cap * 100)) : 0;
      return `<div class="glass pad-l">
        <div class="row"><h2 style="margin:0">${name}</h2><span class="spacer"></span><span class="mut small">${x.sent} / ${x.cap} primeros mensajes</span></div>
        <div class="bar" style="margin:12px 0"><i style="width:${pct}%"></i></div>
        ${warn ? `<div class="banner info">${esc(warn)}</div>` : ''}
        <div class="stat-list">${rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>
        <a class="btn primary" href="${href}">Ir a trabajar en ${name} →</a></div>`;
    }
    const me = CUR;
    CUR.onCounters = () => { if (CUR === me && !me.reloading) { me.reloading = true; setTimeout(() => { me.reloading = false; if (CUR === me) VIEWS.hoy(el).catch(() => {}); }, 800); } };
  };

  // =================== Pantalla: WhatsApp (Contactar hoy · Seguimiento · Chats) ===================
  VIEWS.whatsapp = async (el, sub = 'contactar', params = {}) => {
    sub = ['contactar', 'seguimiento', 'chats'].includes(sub) ? sub : 'contactar';
    state.settings = await GET('/settings');
    el.innerHTML = `<div class="head"><div class="grow"><h1>WhatsApp</h1><p class="sub" style="margin:0">Una cosa a la vez: abre WhatsApp con el mensaje listo, envíalo y marca «Enviado».</p></div></div>
      <div class="tabs" id="wtabs">
        <button class="tab ${sub === 'contactar' ? 'on' : ''}" data-t="contactar">Contactar hoy<span class="c" id="t-c"></span></button>
        <button class="tab ${sub === 'seguimiento' ? 'on' : ''}" data-t="seguimiento">Seguimiento<span class="c" id="t-s"></span></button>
        <button class="tab ${sub === 'chats' ? 'on' : ''}" data-t="chats">Conversaciones<span class="c" id="t-ch"></span></button>
      </div><div id="wbody"></div>`;
    $('#wtabs', el).onclick = (e) => { const t = e.target.closest('[data-t]')?.dataset.t; if (t) go('#/whatsapp/' + t); };
    const body = $('#wbody', el);
    const updTabs = async () => {
      try {
        const [t, accs] = await Promise.all([GET('/today', { quiet: true }), GET('/accounts', { quiet: true })]);
        const a = accs.find(x => x.active_here) || accs[0];
        const n = Object.values(t).reduce((s, g) => s + g.length, 0);
        if ($('#t-s', el)) $('#t-s', el).textContent = n ? `${n} pendientes` : 'al día';
        if ($('#t-c', el)) $('#t-c', el).textContent = a ? `quedan ${Math.max(0, Math.min(a.daily_limit - a.sent_today, a.pending + (state.counters.wa_unassigned || 0)))}` : '';
        if ($('#t-ch', el)) $('#t-ch', el).innerHTML = t.escribieron.length ? `<span class="dot-n">${t.escribieron.length}</span>` : '';
      } catch {}
    };
    updTabs();
    CUR.onCounters = updTabs;
    if (sub === 'contactar') return waContactar(body, params, updTabs);
    if (sub === 'seguimiento') return waSeguimiento(body, params);
    return waChats(body, params);
  };

  async function waContactar(el, params, updTabs) {
    const skipped = [];
    let filterImport = params.lista || '';
    let data = null, excludeTpl = null, cd = null;
    const lists = await GET('/imports?channel=whatsapp');

    async function load() {
      const accs = await GET('/accounts');
      state.waAccounts = accs;
      if (!accs.length) {
        el.innerHTML = `<div class="glass">${emptyState('📱', 'Todavía no agregaste tu WhatsApp', 'Agrega el número con el que prospectas y su cupo diario.', 'Agregar mi WhatsApp', '#/cuentas_wa')}</div>`;
        return;
      }
      const q = new URLSearchParams({ exclude: skipped.join(','), ...(filterImport ? { import_id: filterImport } : {}), ...(excludeTpl ? { exclude_template: excludeTpl } : {}) });
      data = await GET('/send/next?' + q);
      render(accs);
    }
    function render(accs) {
      const a = accs.find(x => x.id === data.account_id) || accs[0];
      const q = data.quota || { enviados: 0, cupo: a.daily_limit };
      const lead = data.lead;
      el.innerHTML = `
        <div class="work">
          <div class="glass pad">
            <div class="lab">Cupo de hoy · ${esc(a.name)}</div>
            <div class="big-n">${q.enviados} <span>/ ${q.cupo}</span></div>
            ${quotaBar(q.enviados, q.cupo)}
            <div class="small mut">Solo cuentan los primeros mensajes.</div>
            <div class="acc-list">
              <div class="lab" style="margin-top:4px">Tus cuentas</div>
              ${accs.map(x => `<div class="ac ${x.id === a.id ? 'on' : ''}">
                <span class="dot ok"></span>
                <div style="min-width:0"><div class="nm">${esc(x.name)}</div><div class="meta">${x.sent_today}/${x.daily_limit} · ${x.full ? '<span class="warn-t">cupo lleno</span>' : `${x.pending} pendientes`}</div></div>
                <span class="r">${x.id === a.id ? '<span class="pill ok">trabajando aquí</span>' : `<button class="btn xs" data-use="${x.id}">Usar esta</button>`}</span></div>`).join('')}
            </div>
            <label class="f" style="margin-top:16px">Lista
              <select id="flt"><option value="">Todas las listas</option>${lists.map(l => `<option value="${l.id}" ${String(l.id) === String(filterImport) ? 'selected' : ''}>${esc(l.name)} (${l.por_contactar || 0})</option>`).join('')}</select></label>
          </div>
          <div id="card"></div>
        </div>`;
      $$('[data-use]', el).forEach(b => (b.onclick = async () => {
        await PATCH('/settings', { wa_active_account: b.dataset.use }); skipped.length = 0; excludeTpl = null; load();
      }));
      $('#flt', el).onchange = (e) => { filterImport = e.target.value; skipped.length = 0; load(); };
      const card = $('#card', el);
      const banners = [];
      if (!data.in_hours) banners.push(`<div class="banner warn">🕘 Estás fuera de tu horario (${esc(state.settings.work_start)}–${esc(state.settings.work_end)}). Puedes enviar igual, pero responden menos.</div>`);
      if (q.llena) banners.push(`<div class="banner warn">Esta cuenta ya llegó a su cupo de hoy. ${accs.some(x => !x.full && x.id !== a.id) ? 'Pasa a otra cuenta con "Usar esta".' : 'Sigue mañana o revisa tus seguimientos.'}</div>`);
      if (!lead) {
        card.innerHTML = banners.join('') + `<div class="glass">${skipped.length
          ? emptyState('⏭️', 'Salteaste los que quedaban', 'Vuelve a empezar la lista o sube más leads.', 'Ir a Base de datos', '#/base')
          : emptyState('📭', 'No hay leads para esta cuenta', 'Sube un Excel en Base de datos y repártelo entre tus cuentas.', 'Subir un Excel', '#/base')}
          ${skipped.length ? '<div style="text-align:center;margin:-20px 0 30px"><button class="btn" id="reset">Volver a ver los salteados</button></div>' : ''}</div>`;
        const r = $('#reset', card); if (r) r.onclick = () => { skipped.length = 0; load(); };
        return;
      }
      const msg = data.message || { body: '' };
      const biz = lead.name && !lead.person_name;
      card.innerHTML = banners.join('') + `
        <div class="glass pad-l">
          <div class="lead-top">
            <div class="av">${esc(initials(lead.name))}</div>
            <div style="min-width:0"><h2>${esc(lead.name || 'Sin nombre')}</h2><div class="mut mono">${esc(lead.phone_pretty)}</div></div>
            <div class="lead-side">Lista<b>${esc(lead.import_name || '—')}</b><span>quedan ${data.remaining}</span></div>
          </div>
          <div class="chips" style="margin:16px 0 18px">${lead.rubro ? `<span class="chip k">${esc(lead.rubro)}</span>` : ''}${lead.city ? `<span class="chip">${esc(lead.city)}</span>` : ''}<span class="chip">${marketLabel(lead.market)}</span>${extraChips(lead.extra)}</div>
          <div class="lab" style="margin-bottom:8px">Mensaje listo</div>
          <textarea class="msg" id="txt">${esc(msg.body)}</textarea>
          <div class="hint">${biz && msg.body ? 'El nombre parece de un negocio, así que el saludo va sin nombre. ' : ''}Toca «Abrir WhatsApp», envía el mensaje y vuelve para marcar «Enviado».</div>
          <div class="actions">
            <button class="btn primary big" id="open" ${q.llena ? 'disabled' : ''}>Abrir WhatsApp</button>
            <button class="btn okb big" id="sent" disabled>Enviado ✓</button>
            <button class="btn" id="var">↻ Otra variante</button>
            <button class="btn ghost" id="skip">Saltear</button>
            <span class="spacer"></span>
            <button class="btn bad" id="nowa">No tiene WhatsApp</button>
            <button class="btn bad" id="nos">No sirve</button>
          </div>
          <div class="row small mut" style="margin-top:14px;gap:18px"><span>Horario: <b style="color:var(--txt)">${esc(state.settings.work_start)}–${esc(state.settings.work_end)}</b></span><span>Pausa entre mensajes: <b style="color:var(--txt)">${mmss(+state.settings.min_delay_sec)}–${mmss(+state.settings.max_delay_sec)}</b></span></div>
        </div>`;
      const txt = $('#txt', card), openBtn = $('#open', card), sent = $('#sent', card);
      let opened = false;
      txt.oninput = () => { opened = false; sent.disabled = true; };
      txt.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); (opened ? sent : openBtn).click(); } };
      if (data.wait_sec > 0 && !q.llena) countdown(openBtn, data.wait_sec);
      openBtn.onclick = () => {
        if (openBtn.disabled) return;
        const body = txt.value.trim();
        if (!body) return toast('El mensaje está vacío.', 'warn');
        openWhatsApp(lead.phone, body);
        opened = true; sent.disabled = false;
      };
      sent.onclick = async () => {
        if (!opened || sent.disabled) return;
        sent.disabled = true; sent.innerHTML = 'Guardando…';
        try {
          await POST('/send/greeting', { contact_id: lead.id, account_id: a.id, body: txt.value.trim(), template_id: msg.template_id });
          toast('Registrado ✓', 'ok');
          excludeTpl = null;
          await load(); updTabs(); refreshCounters();
        } catch { sent.disabled = false; sent.innerHTML = 'Enviado ✓'; }
      };
      $('#nowa', card).onclick = async () => { await PATCH(`/contacts/${lead.id}`, { has_wa: 0 }); toast('Marcado sin WhatsApp: no vuelve a aparecer.'); excludeTpl = null; load(); updTabs(); };
      $('#var', card).onclick = () => { excludeTpl = msg.template_id; load(); };
      $('#skip', card).onclick = () => { skipped.push(lead.id); excludeTpl = null; load(); };
      $('#nos', card).onclick = async () => { await POST(`/contacts/${lead.id}/discard`, { reason: 'no_sirve' }); toast('Descartado.'); excludeTpl = null; load(); updTabs(); };
    }
    function countdown(btn, sec) {
      clearInterval(cd);
      let s = sec; btn.disabled = true;
      const tick = () => {
        if (!document.body.contains(btn)) return clearInterval(cd);
        if (s <= 0) { clearInterval(cd); btn.disabled = false; btn.innerHTML = 'Abrir WhatsApp'; return; }
        btn.innerHTML = `<span class="countdown">Próximo en ${mmss(s)}</span>`; s--;
      };
      tick(); cd = setInterval(tick, 1000);
    }
    CUR.cleanup.push(() => clearInterval(cd));
    CUR.onRemote = () => { if (!$('#sent', el) || $('#sent', el).disabled) load().catch(() => {}); };
    await load();
  }

  // En el celular: al abrir un chat se oculta la lista y aparece "← Volver"
  function detailMode(splitEl, panelEl, on, onBack) {
    splitEl.classList.toggle('detail', !!on);
    if (on && isMobile()) {
      const b = document.createElement('button');
      b.className = 'btn sm ghost back-btn'; b.textContent = '← Volver a la lista';
      b.onclick = () => { splitEl.classList.remove('detail'); onBack?.(); window.scrollTo(0, 0); };
      panelEl.prepend(b);
      window.scrollTo(0, 0);
    }
  }

  const TASK_GROUPS = [
    ['escribieron', 'Te escribieron', 'manual'], ['pitch', 'Mandar pitch', 'pitch'], ['seguimiento', 'Seguimiento', 'seguimiento'],
    ['reunion_push', 'Llevar a la reunión', 'reunion'], ['reuniones', 'Reuniones próximas', 'manual'],
    ['retomar_no', 'Retomar un "no"', 'seguimiento_no'], ['cerrar', 'Para cerrar', 'manual'],
  ];
  async function waSeguimiento(el, params) {
    let tasks = {}, sel = params.c ? Number(params.c) : null, selKind = null, panel = null;
    const closed = new Set();
    el.innerHTML = `<div class="split"><div id="list"></div><div id="panel" class="sticky"></div></div>`;
    async function loadList() {
      tasks = await GET('/today');
      const total = Object.values(tasks).reduce((n, g) => n + g.length, 0);
      const list = $('#list', el);
      if (!total) {
        list.innerHTML = `<div class="glass">${emptyState('✅', 'Estás al día', 'No hay respuestas, pitches ni seguimientos pendientes por ahora.', 'Contactar leads nuevos', '#/whatsapp/contactar')}</div>`;
        return;
      }
      list.innerHTML = TASK_GROUPS.filter(([k]) => tasks[k]?.length).map(([k, label]) => `
        <div class="group ${closed.has(k) ? 'closed' : ''}" data-g="${k}">
          <div class="group-h"><h3>${label}</h3><span class="cnt">${tasks[k].length}</span><span class="chev">▾</span></div>
          <div class="items">${tasks[k].map(c => `
            <div class="item ${c.id === sel ? 'on' : ''}" data-id="${c.id}" data-k="${k}">
              <div class="grow"><div class="t">${esc(c.name || c.phone_pretty)}</div>
              <div class="d">${k === 'seguimiento' ? `Paso ${c.step}/5 · ` : ''}${k === 'reuniones' ? '📅 ' + fmtDateTime(c.meeting_at) + ' · ' : ''}${esc(stageLabel(c.stage))} · ${rel(Math.max(c.last_in_at || 0, c.last_out_at || 0))}</div></div>
              ${c.unread ? `<span class="unread">${c.unread}</span>` : ''}
              ${k === 'cerrar' ? `<button class="btn xs bad" data-lost="${c.id}">Perdido</button>` : ''}
            </div>`).join('')}</div></div>`).join('');
    }
    async function open(id, kindGroup) {
      sel = id; $$('.item', el).forEach(i => i.classList.toggle('on', Number(i.dataset.id) === id));
      const g = TASK_GROUPS.find(x => x[0] === kindGroup);
      selKind = g ? g[2] : null;
      panel = await chatPanel($('#panel', el), id, { suggest: selKind, onChange: async (what) => { await loadList(); if (what === 'snoozed' || what === 'discarded') { $('#panel', el).innerHTML = ''; sel = null; CUR.openContact = null; $('.split', el).classList.remove('detail'); } } });
      detailMode($('.split', el), $('#panel', el), true, () => { sel = null; });
    }
    $('#list', el).onclick = async (e) => {
      const lost = e.target.closest('[data-lost]');
      if (lost) { e.stopPropagation(); await POST(`/contacts/${lost.dataset.lost}/discard`, { reason: 'sin_respuesta' }); toast('Marcado como perdido.'); return loadList(); }
      const gh = e.target.closest('.group-h');
      if (gh) { const g = gh.parentElement.dataset.g; closed.has(g) ? closed.delete(g) : closed.add(g); gh.parentElement.classList.toggle('closed'); return; }
      const it = e.target.closest('.item'); if (it) open(Number(it.dataset.id), it.dataset.k);
    };
    await loadList();
    if (sel) { const k = Object.entries(tasks).find(([, l]) => l.some(c => c.id === sel))?.[0]; open(sel, k); }
    else $('#panel', el).innerHTML = Object.values(tasks).some(l => l.length) ? '<div class="glass pad-l mut">Toca una tarea para abrir el chat y el mensaje sugerido.</div>' : '';
    CUR.onRemote = () => loadList().catch(() => {});
  }

  const CHAT_GROUPS = [
    ['unread', 'Te escribieron (sin contestar)'], ['respondio', 'Respondió'], ['interesado', 'Interesado'], ['reunion', 'Reunión'],
    ['pitch_enviado', 'Pitch enviado'], ['contactado', 'Contactado'], ['no_interesado', 'No interesado'], ['ganado', 'Ganado'], ['perdido', 'Perdido'], ['por_contactar', 'Por contactar'],
  ];
  async function waChats(el, params) {
    let rows = [], sel = params.c ? Number(params.c) : null, panel = null, q = '';
    const closed = new Set(['perdido', 'ganado', 'no_interesado']);
    el.innerHTML = `<div class="split"><div><input type="search" id="q" placeholder="Buscar por nombre o número" style="width:100%;margin-bottom:12px"><div id="list"></div></div><div id="panel" class="sticky"></div></div>`;
    async function loadList() {
      rows = await GET('/inbox' + (q ? '?q=' + encodeURIComponent(q) : ''));
      const groups = Object.fromEntries(CHAT_GROUPS.map(([k]) => [k, []]));
      for (const r of rows) {
        if ((r.last_in_at || 0) > (r.last_out_at || 0) && !['respondio', 'interesado'].includes(r.stage)) groups.unread.push(r);
        else (groups[r.stage] || groups.contactado).push(r);
      }
      const list = $('#list', el);
      if (!rows.length) { list.innerHTML = `<div class="glass">${emptyState('💬', 'Todavía no hay conversaciones', 'Aparecen aquí cuando registras el primer mensaje.', 'Contactar hoy', '#/whatsapp/contactar')}</div>`; return; }
      list.innerHTML = CHAT_GROUPS.filter(([k]) => groups[k].length).map(([k, label]) => {
        const un = groups[k].reduce((n, r) => n + (r.unread || 0), 0);
        const shown = groups[k].slice(0, 150);
        return `<div class="group ${closed.has(k) ? 'closed' : ''}" data-g="${k}">
          <div class="group-h"><h3>${label}</h3><span class="cnt">${groups[k].length}</span>${un ? `<span class="unread item" style="border:0;padding:0 7px;background:var(--ok);color:#06251a;border-radius:99px;font-size:11.5px;font-weight:700">${un}</span>` : ''}<span class="chev">▾</span></div>
          <div class="items">${shown.map(r => `<div class="item ${r.id === sel ? 'on' : ''}" data-id="${r.id}">
            <div class="grow"><div class="t">${esc(r.name || r.phone_pretty)}</div><div class="d">${r.last_dir === 'out' ? 'Tú: ' : ''}${esc(r.last_body || '')}</div></div>
            <div class="tiny mut" style="text-align:right;white-space:nowrap">${rel(Math.max(r.last_in_at || 0, r.last_out_at || 0))}<br>${esc(r.account_name || '')}</div>
            ${r.unread ? `<span class="unread">${r.unread}</span>` : ''}</div>`).join('')}
            ${groups[k].length > shown.length ? `<div class="mut small" style="padding:6px">+${groups[k].length - shown.length} más · usa el buscador</div>` : ''}</div></div>`;
      }).join('');
    }
    async function open(id) {
      sel = id; $$('.item[data-id]', el).forEach(i => i.classList.toggle('on', Number(i.dataset.id) === id));
      panel = await chatPanel($('#panel', el), id, { onChange: () => { loadList(); refreshCounters(); } });
      detailMode($('.split', el), $('#panel', el), true, () => { sel = null; });
    }
    $('#list', el).onclick = (e) => {
      const gh = e.target.closest('.group-h');
      if (gh) { const g = gh.parentElement.dataset.g; closed.has(g) ? closed.delete(g) : closed.add(g); gh.parentElement.classList.toggle('closed'); return; }
      const it = e.target.closest('.item[data-id]'); if (it) open(Number(it.dataset.id));
    };
    let qt; $('#q', el).oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); loadList(); }, 250); };
    await loadList();
    if (sel) open(sel); else $('#panel', el).innerHTML = rows.length ? '<div class="glass pad-l mut">Elige una conversación.</div>' : '';
    CUR.onRemote = () => loadList().catch(() => {});
  }

  // =================== Pantalla: Instagram ===================
  VIEWS.instagram = async (el, sub = 'contactar', params = {}) => {
    sub = ['contactar', 'seguimiento', 'todos'].includes(sub) ? sub : 'contactar';
    state.settings = await GET('/settings');
    const accs = await GET('/ig/accounts');
    state.igAccounts = accs;
    if (!accs.length) {
      el.innerHTML = `<h1>Instagram</h1><div class="glass">${emptyState('📸', 'Todavía no agregaste tu cuenta de Instagram', 'Agrégala con su cupo diario. Los perfiles se abren en tu Instagram (app en el celular, navegador en la PC).', 'Agregar cuenta de Instagram', '#/cuentas_ig')}</div>`;
      return;
    }
    el.innerHTML = `<div class="head"><div class="grow"><h1>Instagram</h1><p class="sub" style="margin:0">El CRM copia el mensaje y abre el perfil. Tú lo pegas y lo envías en Instagram.</p></div></div>
      <div class="tabs" id="itabs">
        <button class="tab ${sub === 'contactar' ? 'on' : ''}" data-t="contactar">Contactar hoy<span class="c" id="it-c"></span></button>
        <button class="tab ${sub === 'seguimiento' ? 'on' : ''}" data-t="seguimiento">Seguimiento<span class="c" id="it-s"></span></button>
        <button class="tab ${sub === 'todos' ? 'on' : ''}" data-t="todos">Todos los leads<span class="c" id="it-t"></span></button>
      </div><div id="ibody"></div>`;
    $('#itabs', el).onclick = (e) => { const t = e.target.closest('[data-t]')?.dataset.t; if (t) go('#/instagram/' + t); };
    const upd = async () => {
      const [a2, fu] = await Promise.all([GET('/ig/accounts', { quiet: true }), GET('/ig/followups', { quiet: true })]).catch(() => [null, null]);
      if (!a2) return;
      state.igAccounts = a2;
      const act = a2.find(a => a.active_here) || a2[0];
      if ($('#it-c', el)) $('#it-c', el).textContent = `quedan ${Math.max(0, act.daily_limit - act.sent_today)} del cupo`;
      if ($('#it-s', el)) $('#it-s', el).textContent = fu.length ? `${fu.length} pendientes` : 'al día';
    };
    upd(); CUR.onCounters = upd;
    const body = $('#ibody', el);
    if (sub === 'contactar') return igContactar(body, params, upd);
    if (sub === 'seguimiento') return igSeguimiento(body, params, upd);
    return igTodos(body, params);
  };

  async function igAccountsBlock(accs, active) {
    return accs.map(x => `<div class="ac ${x.id === active.id ? 'on' : ''}">
      <span class="dot" style="background:${/^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : '#2563EB'}"></span>
      <div style="min-width:0"><div class="nm">${esc(x.name)}${x.username ? ` <span class="mut small">@${esc(x.username)}</span>` : ''}</div>
      <div class="meta">${x.sent_today}/${x.daily_limit}${x.full ? ' · <span class="warn-t">cupo lleno</span>' : ` · ${x.pending} pendientes`}</div></div>
      <span class="r">${x.id === active.id ? '<span class="pill ok">trabajando aquí</span>' : `<button class="btn xs" data-use="${x.id}">Usar esta</button>`}</span></div>`).join('');
  }

  async function igContactar(el, params, upd) {
    const skipped = [];
    let excludeTpl = null, opened = false, filterImport = '';
    const lists = await GET('/imports?channel=instagram');
    async function load() {
      const accs = await GET('/ig/accounts'); state.igAccounts = accs;
      const active = accs.find(a => a.active_here) || accs[0];
      const q = new URLSearchParams({ account_id: active.id, exclude: skipped.join(','), ...(filterImport ? { import_id: filterImport } : {}), ...(excludeTpl ? { exclude_template: excludeTpl } : {}) });
      const d = await GET('/ig/next?' + q);
      opened = false;
      const quota = d.quota || { enviados: 0, cupo: active.daily_limit };
      const l = d.lead, msg = d.message || { body: '' };
      el.innerHTML = `<div class="work">
        <div class="glass pad">
          <div class="lab">Cupo de hoy · ${esc(active.name)}</div>
          <div class="big-n">${quota.enviados} <span>/ ${quota.cupo}</span></div>${quotaBar(quota.enviados, quota.cupo)}
          <div class="acc-list"><div class="lab" style="margin-top:4px">Tus cuentas</div>${await igAccountsBlock(accs, active)}</div>
          <label class="f" style="margin-top:16px">Lista<select id="flt"><option value="">Todas las listas</option>${lists.map(x => `<option value="${x.id}" ${String(x.id) === String(filterImport) ? 'selected' : ''}>${esc(x.name)} (${x.por_contactar || 0})</option>`).join('')}</select></label>
        </div>
        <div id="card">${!d.in_hours ? `<div class="banner warn">🕘 Estás fuera de tu horario. Puedes seguir, pero responden menos.</div>` : ''}
        ${quota.llena ? `<div class="banner warn">Esta cuenta ya llegó a su cupo de hoy. ${accs.some(a => !a.full && a.id !== active.id) ? 'Pasa a otra cuenta con "Usar esta".' : 'Sigue mañana o revisa los seguimientos.'}</div>` : ''}
        ${l ? `<div class="glass pad-l">
          <div class="lead-top"><div class="av" style="background:linear-gradient(135deg,#7c3aed,#f472b6)">${esc(initials(l.name || l.username))}</div>
            <div style="min-width:0"><h2 style="font-size:24px">@${esc(l.username)}</h2><div class="mut">${esc(l.name || '')}</div></div>
            <div class="lead-side">Lista<b>${esc(l.import_name || '—')}</b><span>quedan ${d.remaining}</span></div></div>
          <div class="chips" style="margin:14px 0 16px">${l.rubro ? `<span class="chip k">${esc(l.rubro)}</span>` : ''}${l.followers ? `<span class="chip">${Number(l.followers).toLocaleString('es-CO')} seguidores</span>` : ''}<span class="chip">${marketLabel(l.market)}</span>${extraChips(l.extra)}</div>
          <div class="lab" style="margin-bottom:8px">Primer mensaje (se copia al abrir)</div>
          <textarea class="msg" id="txt" style="min-height:76px">${esc(msg.body)}</textarea>
          <div class="hint">💡 Si viste algo concreto en su perfil, agrégalo en la primera línea. Si tiene historia activa, responde la historia: llega mejor.</div>
          <div class="actions">
            <button class="btn primary big" id="open">Abrir Instagram</button>
            <button class="btn okb big" id="sent" disabled>Enviado ✓</button>
            <button class="btn" id="var">↻ Otra variante</button>
            <button class="btn ghost" id="dm">Ir directo al chat</button>
            <span class="spacer"></span>
            <button class="btn ghost" id="skip">Saltear</button>
            <button class="btn bad" id="noex">No existe</button>
            <button class="btn bad" id="nos">No sirve</button>
          </div></div>`
        : `<div class="glass">${skipped.length ? emptyState('⏭️', 'Salteaste los que quedaban', 'Vuelve a ver los salteados o sube más leads.', 'Ir a Base de datos', '#/base?ch=instagram') : emptyState('📭', 'No hay leads de Instagram para esta cuenta', 'Sube un Excel con usuarios o links de perfil en Base de datos.', 'Subir un Excel', '#/base?ch=instagram')}</div>`}
        </div></div>`;
      $$('[data-use]', el).forEach(b => (b.onclick = async () => { await PATCH('/settings', { ig_active_account: b.dataset.use }); skipped.length = 0; load(); upd(); }));
      $('#flt', el).onchange = (e) => { filterImport = e.target.value; skipped.length = 0; load(); };
      if (!l) return;
      const txt = $('#txt', el), sentBtn = $('#sent', el);
      const doOpen = async (url) => {
        const ok = await copy(txt.value.trim());
        openInstagram(url);
        opened = true; sentBtn.disabled = quota.llena;
        toast(ok ? (isMobile() ? 'Mensaje copiado. En Instagram toca «Mensaje» y pégalo.' : 'Mensaje copiado. Pégalo en Instagram con Ctrl+V.') : 'Copia el mensaje a mano.', ok ? 'ok' : 'warn');
      };
      $('#open', el).onclick = () => doOpen(`https://www.instagram.com/${l.username}/`);
      $('#dm', el).onclick = () => doOpen(`https://ig.me/m/${l.username}`);
      sentBtn.onclick = async () => {
        if (!opened) return;
        sentBtn.disabled = true;
        try { await POST(`/ig/${l.id}/contacted`, { kind: 'first', account_id: active.id }); toast('Registrado ✓', 'ok'); excludeTpl = null; await load(); upd(); }
        catch { sentBtn.disabled = false; }
      };
      $('#var', el).onclick = () => { excludeTpl = msg.template_id; load(); };
      $('#skip', el).onclick = () => { skipped.push(l.id); excludeTpl = null; load(); };
      $('#noex', el).onclick = async () => { await POST(`/ig/${l.id}/discard`, { reason: 'no_existe' }); toast('Descartado: no existe.'); load(); upd(); };
      $('#nos', el).onclick = async () => { await POST(`/ig/${l.id}/discard`, { reason: 'no_sirve' }); toast('Descartado.'); load(); upd(); };
    }
    await load();
  }

  async function igSeguimiento(el, params, upd) {
    let idx = 0, excludeTpl = null, opened = false;
    async function load() {
      const accs = await GET('/ig/accounts'); state.igAccounts = accs;
      const active = accs.find(a => a.active_here) || accs[0];
      const list = await GET('/ig/followups');
      if (idx >= list.length) idx = 0;
      const l = list[idx];
      if (!l) { el.innerHTML = `<div class="glass">${emptyState('✅', 'No hay seguimientos de Instagram para hoy', 'Aparecen solos el día que toca.', 'Contactar leads nuevos', '#/instagram/contactar')}</div>`; return; }
      const acc = accs.find(a => a.id === l.account_id) || active; // sin cuenta asignada → la activa
      let msg = l.message || { body: '' };
      if (excludeTpl) { msg = await GET(`/ig/followups/${l.id}/render?exclude=${excludeTpl}`); }
      opened = false;
      el.innerHTML = `<div class="glass pad-l">
        <div class="row" style="margin-bottom:12px"><span class="pill acc">Paso ${l.step}/5</span><span class="mut small">${idx + 1} de ${list.length}</span><span class="spacer"></span><span class="small">Cuenta: <b>${esc(acc.name)}</b></span></div>
        <div class="lead-top"><div class="av" style="background:linear-gradient(135deg,#7c3aed,#f472b6)">${esc(initials(l.name || l.username))}</div>
          <div><h2>@${esc(l.username)}</h2><div class="mut">${esc(l.name || '')} · último contacto ${rel(l.last_contact_at)}</div></div></div>
        <div class="lab" style="margin:16px 0 8px">Mensaje del paso ${l.step} (se copia al abrir)</div>
        <textarea class="msg" id="txt" style="min-height:70px">${esc(msg.body)}</textarea>
        <div class="actions" style="margin-top:14px">
          <button class="btn primary big" id="open">Abrir chat</button>
          <button class="btn okb big" id="sent" disabled>Enviado ✓</button>
          <button class="btn" id="rep">Respondió</button>
          <button class="btn" id="var">↻ Otra variante</button>
          <span class="spacer"></span>
          <button class="btn ghost" id="later">Después</button>
          <button class="btn bad" id="nos">No sirve</button>
        </div></div>`;
      const sentBtn = $('#sent', el);
      $('#open', el).onclick = async () => {
        const ok = await copy($('#txt', el).value.trim());
        openInstagram(`https://ig.me/m/${l.username}`);
        opened = true; sentBtn.disabled = false;
        toast(ok ? 'Mensaje copiado. Entra a "Mensaje" en su perfil y pégalo.' : 'Copia el mensaje a mano.', ok ? 'ok' : 'warn');
      };
      sentBtn.onclick = async () => {
        if (!opened || sentBtn.disabled) return;
        sentBtn.disabled = true;
        try { await POST(`/ig/${l.id}/contacted`, { kind: 'followup', account_id: acc.id }); toast('Seguimiento registrado ✓', 'ok'); excludeTpl = null; load(); upd(); }
        catch { sentBtn.disabled = false; }
      };
      $('#rep', el).onclick = async () => { await POST(`/ig/${l.id}/replied`); toast('¡Bien! Pasó a "Respondió".', 'ok'); excludeTpl = null; load(); upd(); };
      $('#var', el).onclick = () => { excludeTpl = msg.template_id; load(); };
      $('#later', el).onclick = async () => { await PATCH(`/ig/${l.id}`, { snooze_days: 1 }); toast('Lo verás mañana.'); excludeTpl = null; load(); upd(); };
      $('#nos', el).onclick = async () => { await POST(`/ig/${l.id}/discard`, { reason: 'no_sirve' }); toast('Descartado.'); excludeTpl = null; load(); upd(); };
    }
    await load();
  }

  async function igTodos(el, params) {
    const f = { status: '', account_id: '', import_id: '', q: '', sort: '', page: 0 };
    const [accs, lists] = [state.igAccounts, await GET('/imports?channel=instagram')];
    el.innerHTML = `<div class="glass pad">
      <div class="row" style="margin-bottom:12px">
        <input type="search" id="q" placeholder="Buscar @usuario, nombre, notas" style="flex:1;min-width:200px">
        <select id="st"><option value="">Todos los estados</option>${state.meta.ig_statuses.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
        <select id="ac"><option value="">Todas las cuentas</option>${accs.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
        <select id="li"><option value="">Todas las listas</option>${lists.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select>
        <select id="so"><option value="">Más recientes</option><option value="followers">Más seguidores</option></select>
      </div><div id="tbl"></div></div>`;
    async function load() {
      const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), limit: 50 });
      const r = await GET('/ig?' + q);
      $('#tbl', el).innerHTML = r.rows.length ? `<table class="t"><thead><tr><th>Usuario</th><th>Nombre</th><th class="num">Seguidores</th><th>Estado</th><th>Cuenta</th><th>Último contacto</th></tr></thead>
        <tbody>${r.rows.map(l => `<tr class="click" data-id="${l.id}"><td><b>@${esc(l.username)}</b></td><td>${esc(l.name || '')}</td><td class="num">${l.followers != null ? Number(l.followers).toLocaleString('es-CO') : '—'}</td>
        <td><span class="pill ${['respondio', 'en_conversacion', 'reunion', 'cerrado'].includes(l.status) ? 'ok' : l.status === 'descartado' ? 'bad' : ''}">${esc(igLabel(l.status))}</span></td>
        <td>${esc(l.account_name || '—')}</td><td class="mut">${l.last_contact_at ? rel(l.last_contact_at) : '—'}</td></tr>`).join('')}</tbody></table>
        <div class="row" style="margin-top:12px"><span class="mut small">${r.total} leads</span><span class="spacer"></span>
        <button class="btn sm" id="prev" ${f.page ? '' : 'disabled'}>‹ Anterior</button><button class="btn sm" id="next" ${(f.page + 1) * 50 < r.total ? '' : 'disabled'}>Siguiente ›</button></div>`
        : '<p class="mut">No hay leads con estos filtros.</p>';
      const p = $('#prev', el), n = $('#next', el);
      if (p) p.onclick = () => { f.page--; load(); }; if (n) n.onclick = () => { f.page++; load(); };
    }
    const bindF = (id, k) => ($(`#${id}`, el).onchange = (e) => { f[k] = e.target.value; f.page = 0; load(); });
    bindF('st', 'status'); bindF('ac', 'account_id'); bindF('li', 'import_id'); bindF('so', 'sort');
    let qt; $('#q', el).oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value.trim(); f.page = 0; load(); }, 250); };
    $('#tbl', el).onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) igFicha(Number(tr.dataset.id), load); };
    await load();
    if (params.l) igFicha(Number(params.l), load);
  }

  async function igFicha(id, onSaved) {
    const l = await GET(`/ig/lead/${id}`);
    const accs = state.igAccounts.length ? state.igAccounts : await GET('/ig/accounts');
    const m = modal(`<h2>@${esc(l.username)}</h2><p class="mut">${esc(l.name || '')} ${l.import_name ? '· Lista: ' + esc(l.import_name) : ''}</p>
      <div class="grid g2">
        <label class="f">Estado<select id="f-st">${state.meta.ig_statuses.map(s => `<option value="${s.id}" ${s.id === l.status ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label class="f">Seguidores<input type="text" id="f-fo" value="${l.followers ?? ''}" placeholder="Ej.: 12500 o 12,5k"></label>
        <label class="f">Reunión<input type="datetime-local" id="f-mt" value="${toLocalInput(l.meeting_at)}"></label>
        <label class="f">Cuenta<select id="f-ac"><option value="">Sin asignar</option>${accs.map(a => `<option value="${a.id}" ${a.id === l.account_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      </div>
      <label class="f" style="margin-top:12px">Notas<textarea id="f-no" rows="3">${esc(l.notes || '')}</textarea></label>
      <div class="chips" style="margin-top:12px">${l.first_contact_at ? `<span class="chip">Primer contacto ${fmtDate(l.first_contact_at)}</span>` : ''}${l.replied_at ? `<span class="chip">Respondió ${fmtDate(l.replied_at)}</span>` : ''}<span class="chip">Seguimientos: ${l.fu_count || 0}/5</span>${extraChips(l.extra)}</div>
      <div class="foot"><button class="btn ghost" id="f-open">Abrir perfil</button>${l.meeting_at ? '<button class="btn ghost" id="f-gc">📅 Google Calendar</button>' : ''}<span class="spacer"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="f-ok">Guardar</button></div>`, { wide: true });
    $('#f-open', m.el).onclick = () => { openInstagram(`https://www.instagram.com/${l.username}/`); };
    const gc = $('#f-gc', m.el); if (gc) gc.onclick = () => openExternal(gcalUrl(`Reunión EDITION · @${l.username}`, l.meeting_at, 'instagram.com/' + l.username));
    $('#f-ok', m.el).onclick = async () => {
      const body = { notes: $('#f-no', m.el).value, followers: $('#f-fo', m.el).value.trim(), account_id: $('#f-ac', m.el).value || null };
      const st = $('#f-st', m.el).value, mt = fromLocalInput($('#f-mt', m.el).value);
      if (st !== l.status) body.status = st;              // solo si cambió
      if ((mt || null) !== (l.meeting_at || null)) body.meeting_at = mt;
      await PATCH(`/ig/${id}`, body); toast('Guardado ✓', 'ok'); m.close(); onSaved?.();
      if (body.meeting_at && await confirmBox('¿Agregar la reunión a Google Calendar?', '📅 Agregar')) openExternal(gcalUrl(`Reunión EDITION · @${l.username}`, body.meeting_at, 'instagram.com/' + l.username));
    };
  }

  // =================== Pantalla: Embudo ===================
  const WA_FUNNEL = ['contactado', 'respondio', 'pitch_enviado', 'interesado', 'reunion', 'ganado'];
  const IG_FUNNEL = ['contactado', 'respondio', 'en_conversacion', 'reunion', 'cerrado'];
  VIEWS.embudo = async (el) => {
    el.classList.add('wide'); el.style.maxWidth = '1500px';
    const expanded = new Set();
    async function load() {
      const d = await GET('/funnel');
      const col = (title, rows, stages, out, key, labelFn, nameFn, newCount) => {
        const by = Object.fromEntries([...stages, ...out].map(s => [s, []]));
        for (const r of rows) (by[r[key]] || (by[r[key]] = [])).push(r);
        const width = i => 100 - (45 * i) / Math.max(1, stages.length - 1);
        const chipsFor = (list, rowKey) => {
          const n = list.length, size = n > 40 ? 'xs' : n > 12 ? 'sm' : '';
          const cap = expanded.has(rowKey) ? n : (size === 'xs' ? 120 : 60);
          return list.slice(0, cap).map(r => `<span class="fchip ${size}" data-ch="${title}" data-id="${r.id}" title="${esc(nameFn(r))}">${esc(nameFn(r))}</span>`).join('')
            + (n > cap ? `<span class="fchip ${size} more" data-more="${rowKey}">+${n - cap}</span>` : '');
        };
        return `<div class="glass pad-l"><div class="row" style="margin-bottom:14px"><h2 style="margin:0">${title}</h2><span class="spacer"></span><span class="mut small">${newCount} por contactar</span></div>
          <div class="funnel">${stages.map((s, i) => `<div class="f-row" style="width:${width(i)}%"><div class="h"><b>${esc(labelFn(s))}</b><span>${by[s].length}</span></div><div class="chips">${chipsFor(by[s], title + s)}</div></div>`).join('')}</div>
          <div class="lab" style="margin:18px 0 8px">Fuera del embudo</div>
          ${out.map(s => `<div class="f-row dim" style="margin-bottom:6px"><div class="h"><b>${esc(labelFn(s))}</b><span>${by[s].length}</span></div><div class="chips">${chipsFor(by[s], title + s)}</div></div>`).join('')}</div>`;
      };
      el.innerHTML = `<div class="head"><div class="grow"><h1>Embudo</h1><p class="sub" style="margin:0">Toca un lead para cambiarlo de etapa. Nada de arrastrar.</p></div></div>
        <div class="grid g2">
          ${col('WhatsApp', d.wa, WA_FUNNEL, ['no_interesado', 'perdido'], 'stage', stageLabel, r => r.name || '+' + r.phone, d.wa_new)}
          ${col('Instagram', d.ig, IG_FUNNEL, ['descartado'], 'status', igLabel, r => '@' + r.username, d.ig_new)}
        </div>`;
      el.onclick = (e) => {
        const more = e.target.closest('[data-more]');
        if (more) { expanded.add(more.dataset.more); return load(); }
        const ch = e.target.closest('[data-ch]'); if (!ch) return;
        const id = Number(ch.dataset.id), isWa = ch.dataset.ch === 'WhatsApp';
        const row = (isWa ? d.wa : d.ig).find(r => r.id === id);
        const stages = isWa ? state.meta.stages.filter(s => s.id !== 'por_contactar') : state.meta.ig_statuses.filter(s => s.id !== 'nuevo');
        const cur = isWa ? row.stage : row.status;
        const m = modal(`<h2>${esc(isWa ? (row.name || '+' + row.phone) : '@' + row.username)}</h2><p class="mut">Elige la nueva etapa.</p>
          <div class="big-stage">${stages.map(s => `<button data-s="${s.id}" class="${s.id === cur ? 'on' : ''}">${esc(s.label)}</button>`).join('')}</div>
          <div class="foot">${isWa ? `<a class="btn ghost" href="#/whatsapp/chats?c=${id}" id="goc">Abrir chat</a>` : `<a class="btn ghost" href="#/instagram/todos?l=${id}" id="goc">Abrir ficha</a>`}<span class="spacer"></span><button class="btn ghost" data-close>Cerrar</button></div>`);
        $('#goc', m.el).addEventListener('click', () => m.close());
        $('.big-stage', m.el).onclick = async (ev) => {
          const s = ev.target.closest('[data-s]')?.dataset.s; if (!s || s === cur) return;
          if (isWa && s === 'reunion') { m.close(); return meetingModal(null, row.name || row.phone, async ts => { await PATCH(`/contacts/${id}`, { meeting_at: ts }); load(); }); }
          if (isWa) await PATCH(`/contacts/${id}`, { stage: s }); else await PATCH(`/ig/${id}`, { status: s });
          toast(`Movido a ${isWa ? stageLabel(s) : igLabel(s)} ✓`, 'ok'); m.close(); load();
        };
      };
    }
    await load();
    CUR.onRemote = () => load().catch(() => {});
  };

  // =================== Pantalla: Base de datos ===================
  let xlsxLoading = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxLoading ||= new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/xlsx-0.18.5.min.js'; sc.onload = () => res(window.XLSX); sc.onerror = rej; document.head.appendChild(sc); });
    return xlsxLoading;
  }
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const KEYS = {
    phone: ['telefono', 'phone', 'celular', 'whatsapp', 'numero', 'movil', 'mobile', 'tel', 'phone number', 'telefono 1', 'numero de telefono', 'contact phone', 'wa'],
    name: ['nombre', 'name', 'titulo', 'title', 'negocio', 'empresa', 'business', 'company', 'business name', 'razon social', 'contacto', 'full name'],
    city: ['ciudad', 'city', 'localidad', 'municipio'],
    username: ['instagram', 'usuario', 'username', 'user', 'ig', 'perfil', 'profile', 'cuenta', 'handle', 'instagram url', 'link instagram', 'url instagram'],
    followers: ['seguidores', 'followers', 'followers count', 'n seguidores'],
  };
  function detectColumns(header, rows, channel) {
    const h = header.map(norm);
    const find = (keys, skip = []) => { for (const k of keys) { const i = h.findIndex((x, j) => !skip.includes(j) && (x === k)); if (i >= 0) return i; } for (const k of keys) { const i = h.findIndex((x, j) => !skip.includes(j) && x.includes(k)); if (i >= 0) return i; } return -1; };
    const map = {};
    if (channel === 'whatsapp') {
      map.phone = find(KEYS.phone);
      if (map.phone < 0) { // por contenido: la columna con más dígitos
        let best = -1, bestScore = 0;
        for (let j = 0; j < header.length; j++) {
          const score = rows.slice(0, 50).filter(r => String(r[j] ?? '').replace(/\D/g, '').length >= 7).length;
          if (score > bestScore) { best = j; bestScore = score; }
        }
        map.phone = best;
      }
      map.name = find(KEYS.name, [map.phone]);
      map.city = find(KEYS.city, [map.phone, map.name]);
    } else {
      map.username = find(KEYS.username);
      if (map.username < 0) {
        let best = -1, bestScore = 0;
        for (let j = 0; j < header.length; j++) { const score = rows.slice(0, 50).filter(r => /instagram\.com\/|^@[\w.]+$/i.test(String(r[j] ?? '').trim())).length; if (score > bestScore) { best = j; bestScore = score; } }
        map.username = best;
      }
      map.name = find(KEYS.name, [map.username]);
      map.followers = find(KEYS.followers, [map.username, map.name]);
    }
    return map;
  }
  function readSheet(XLSX, buf) {
    const wb = XLSX.read(buf, { type: 'array', raw: true, cellText: false, cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false })
      .map(r => r.map(v => (typeof v === 'number' ? (Number.isInteger(v) ? BigInt(v).toString() : String(v)) : String(v ?? '').trim())));
    if (!aoa.length) return { header: [], rows: [] };
    const first = aoa[0];
    const known = Object.values(KEYS).flat();
    const looksHeader = first.some(c => known.includes(norm(c)) || known.some(k => norm(c).includes(k))) || first.filter(c => c && !/\d{5,}/.test(c)).length >= Math.ceil(first.length * 0.7);
    const header = looksHeader ? first.map((c, i) => c || `Columna ${i + 1}`) : first.map((_, i) => `Columna ${i + 1}`);
    return { header, rows: looksHeader ? aoa.slice(1) : aoa };
  }

  VIEWS.base = async (el, sub, params) => {
    let ch = params.ch === 'instagram' ? 'instagram' : 'whatsapp';
    el.innerHTML = `<div class="head"><div class="grow"><h1>Base de datos</h1><p class="sub" style="margin:0">Cada Excel que subes es una lista. Repártela entre tus cuentas y empieza.</p></div>
      <div class="subtabs" id="ch"><button data-c="whatsapp">WhatsApp</button><button data-c="instagram">Instagram</button></div></div>
      <div id="up"></div><div id="lists" style="margin-top:18px"></div><div id="search" style="margin-top:24px"></div>`;
    const setCh = c => { ch = c; Object.assign(sf, { q: '', stage: '', import_id: '', account_id: '', page: 0 }); $$('#ch button', el).forEach(b => b.classList.toggle('on', b.dataset.c === c)); renderAll(); };
    $('#ch', el).onclick = e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) setCh(c); };

    async function renderAll() { renderUpload(); await renderLists(); await renderSearch(); }

    function renderUpload() {
      const up = $('#up', el);
      up.innerHTML = `<label class="drop glass" id="drop"><input type="file" id="file" accept=".xlsx,.xls,.csv" hidden>
        <div style="font-size:28px">📄</div><b>Arrastra aquí tu Excel o CSV, o toca para elegirlo</b>
        <div class="mut small">${ch === 'whatsapp' ? 'Solo necesita número y nombre (lo que sale de Google Maps). El resto de las columnas se guarda y se muestra en la tarjeta.' : 'Necesita el usuario o el link del perfil. Nombre y seguidores son opcionales.'}</div></label>`;
      const drop = $('#drop', up), file = $('#file', up);
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); };
      file.onchange = () => file.files[0] && handle(file.files[0]);
    }

    async function handle(f) {
      if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return toast('Ese archivo no es un Excel ni un CSV.', 'warn');
      let XLSX;
      try { XLSX = await loadXLSX(); } catch { return toast('No pude cargar el lector de Excel. Revisa tu internet.', 'bad'); }
      let parsed;
      try { parsed = readSheet(XLSX, new Uint8Array(await f.arrayBuffer())); } catch { return toast('No pude leer ese archivo.', 'bad'); }
      if (!parsed.rows.length) return toast('El archivo está vacío.', 'warn');
      const map = detectColumns(parsed.header, parsed.rows, ch);
      const accs = ch === 'whatsapp' ? await GET('/accounts') : await GET('/ig/accounts');
      const fields = ch === 'whatsapp' ? [['phone', 'Número de teléfono *'], ['name', 'Nombre'], ['city', 'Ciudad']] : [['username', 'Usuario o link de Instagram *'], ['name', 'Nombre'], ['followers', 'Seguidores']];
      const opts = sel => `<option value="-1">— No usar —</option>` + parsed.header.map((hh, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(hh)}${parsed.rows[0]?.[i] ? ' · ej.: ' + esc(String(parsed.rows[0][i]).slice(0, 28)) : ''}</option>`).join('');
      const defCountry = state.settings.country_code || '57';
      const m = modal(`<h2>Importar «${esc(f.name)}»</h2><p class="mut">${parsed.rows.length} filas. Revisa qué columna es cuál.</p>
        <div class="grid g3">${fields.map(([k, l]) => `<label class="f">${l}<select data-map="${k}">${opts(map[k])}</select></label>`).join('')}</div>
        <div class="grid g2" style="margin-top:14px">
          <label class="f">Nombre de la lista<input type="text" id="i-name" value="${esc(f.name.replace(/\.(xlsx|xls|csv)$/i, ''))}"></label>
          <label class="f">Rubro (opcional)<input type="text" id="i-rubro" list="rubros" placeholder="Ej.: Clínicas y estética"><datalist id="rubros">${RUBROS.map(r => `<option value="${r}">`).join('')}</datalist></label>
          <label class="f">Mercado (elige el idioma de las plantillas)<select id="i-market">${state.meta.markets.map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select></label>
          ${ch === 'whatsapp' ? `<label class="f">País (para números sin código)<select id="i-cc">${state.meta.countries.map(x => `<option value="${x.cc}" ${x.cc === defCountry ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>` : '<div></div>'}
        </div>
        <div class="lab" style="margin:16px 0 8px">Repartir entre estas cuentas</div>
        <div class="row">${accs.length ? accs.map(a => `<label class="check"><input type="checkbox" data-acc="${a.id}" checked>${esc(a.name)}</label>`).join('') : '<span class="mut small">No tienes cuentas todavía: los leads quedan sin asignar y los toma la cuenta con la que trabajes.</span>'}</div>
        <div id="prev" style="margin-top:16px"></div>
        <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="i-prev">Ver vista previa</button><button class="btn primary" id="i-ok" disabled>Importar</button></div>`, { wide: true });
      const ccSel = $('#i-cc', m.el);
      $('#i-market', m.el).onchange = e => { if (ccSel) ccSel.value = { es: '34', us: '1' }[e.target.value] || ccSel.value; $('#i-ok', m.el).disabled = true; };
      const build = () => {
        const mp = Object.fromEntries($$('[data-map]', m.el).map(s => [s.dataset.map, Number(s.value)]));
        const used = new Set(Object.values(mp).filter(i => i >= 0));
        const rows = parsed.rows.map(r => {
          const extra = {};
          parsed.header.forEach((hh, i) => { if (!used.has(i) && String(r[i] ?? '').trim()) extra[hh] = String(r[i]).trim(); });
          return ch === 'whatsapp'
            ? { phone: mp.phone >= 0 ? r[mp.phone] : '', name: mp.name >= 0 ? r[mp.name] : '', city: mp.city >= 0 ? r[mp.city] : '', extra }
            : { username: mp.username >= 0 ? r[mp.username] : '', name: mp.name >= 0 ? r[mp.name] : '', followers: mp.followers >= 0 ? r[mp.followers] : '', extra };
        });
        return {
          rows, filename: f.name, name: $('#i-name', m.el).value.trim(), rubro: $('#i-rubro', m.el).value.trim(),
          market: $('#i-market', m.el).value, country: ccSel ? ccSel.value : undefined,
          account_ids: $$('[data-acc]', m.el).filter(c => c.checked).map(c => Number(c.dataset.acc)),
        };
      };
      const preview = async () => {
        const p = build();
        if ((ch === 'whatsapp' && !$$('[data-map]', m.el).find(s => s.dataset.map === 'phone' && s.value !== '-1')) || (ch === 'instagram' && !$$('[data-map]', m.el).find(s => s.dataset.map === 'username' && s.value !== '-1')))
          return toast(ch === 'whatsapp' ? 'Elige la columna del número.' : 'Elige la columna del usuario.', 'warn');
        const r = await POST(`/import/${ch}`, { ...p, dry_run: true });
        $('#prev', m.el).innerHTML = `<div class="grid g4">
          <div class="glass kpi"><div class="lab">Válidos y nuevos</div><div class="v ok-t">${r.valid}</div></div>
          <div class="glass kpi"><div class="lab">Repetidos</div><div class="v">${r.duplicated}</div><div class="s">${r.dup_file} en el archivo · ${r.dup_db} ya estaban</div></div>
          <div class="glass kpi"><div class="lab">Inválidos</div><div class="v ${r.invalid ? 'bad-t' : ''}">${r.invalid}</div></div>
          <div class="glass kpi"><div class="lab">Total</div><div class="v">${r.total}</div></div></div>
          ${r.invalid_examples.length ? `<p class="small mut" style="margin-top:10px">Ejemplos de inválidos: ${r.invalid_examples.map(esc).join(' · ')}</p>` : ''}`;
        $('#i-ok', m.el).disabled = !r.valid;
      };
      $('#i-prev', m.el).onclick = preview;
      $$('[data-map]', m.el).forEach(s => (s.onchange = () => { $('#i-ok', m.el).disabled = true; }));
      $('#i-ok', m.el).onclick = async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          const r = await POST(`/import/${ch}`, build());
          toast(`Lista importada: ${r.added} nuevos, ${r.duplicated} repetidos, ${r.invalid} inválidos.`, 'ok');
          m.close(); renderLists(); refreshCounters();
        } catch { btn.disabled = false; }
      };
      preview().catch(() => {});
    }

    async function renderLists() {
      const lists = await GET(`/imports?channel=${ch}`);
      const box = $('#lists', el);
      if (!lists.length) { box.innerHTML = '<p class="mut">Todavía no subiste ninguna lista en este canal.</p>'; return; }
      box.innerHTML = `<div class="grid g2">${lists.map(l => `<div class="glass list-card">
        <div class="row"><h3 style="margin:0">${esc(l.name)}</h3><span class="pill">${marketLabel(l.market)}</span>${l.rubro ? `<span class="pill acc">${esc(l.rubro)}</span>` : ''}<span class="spacer"></span><span class="mut small">${fmtDate(l.created_at)}</span></div>
        <div class="stats">
          <span><b>${l.total}</b>en el archivo</span><span><b class="ok-t">${l.added}</b>nuevos</span><span><b>${l.duplicated}</b>repetidos</span><span><b>${l.invalid}</b>inválidos</span>
          <span><b>${l.por_contactar || 0}</b>por contactar</span><span><b>${l.contactados || 0}</b>contactados</span><span><b>${l.respondieron || 0}</b>respondieron</span>
        </div>
        <div class="row"><button class="btn sm" data-a="ver" data-id="${l.id}">Ver contactos</button><button class="btn sm" data-a="ren" data-id="${l.id}">Renombrar</button>
          <button class="btn sm" data-a="rep" data-id="${l.id}">Repartir</button><button class="btn sm" data-export="${ch}?import_id=${l.id}">Exportar CSV</button>
          <span class="spacer"></span><button class="btn sm bad" data-a="del" data-id="${l.id}">Borrar</button></div></div>`).join('')}</div>`;
      box.onclick = async (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const l = lists.find(x => String(x.id) === b.dataset.id);
        if (b.dataset.a === 'ver') { sf.import_id = String(l.id); sf.page = 0; await renderSearch(); $('#search', el).scrollIntoView({ behavior: 'smooth' }); }
        if (b.dataset.a === 'ren') {
          const m = modal(`<h2>Editar lista</h2><label class="f">Nombre<input type="text" id="r-n" value="${esc(l.name)}"></label>
            <label class="f" style="margin-top:12px">Mercado<select id="r-m">${state.meta.markets.map(x => `<option value="${x.id}" ${x.id === l.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
            <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="r-ok">Guardar</button></div>`);
          $('#r-ok', m.el).onclick = async () => { await PATCH(`/imports/${l.id}`, { name: $('#r-n', m.el).value, market: $('#r-m', m.el).value }); m.close(); renderLists(); };
        }
        if (b.dataset.a === 'rep') {
          const accs = ch === 'whatsapp' ? await GET('/accounts') : await GET('/ig/accounts');
          if (!accs.length) return toast('Primero agrega una cuenta.', 'warn');
          const m = modal(`<h2>Repartir «${esc(l.name)}»</h2><p class="mut">Los ${l.por_contactar || 0} pendientes se reparten parejo entre las cuentas que elijas. Los ya contactados no se tocan.</p>
            <div class="col">${accs.map(a => `<label class="check"><input type="checkbox" data-acc="${a.id}" checked>${esc(a.name)} <span class="mut small">(${a.pending} pendientes)</span></label>`).join('')}</div>
            <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="d-ok">Repartir</button></div>`);
          $('#d-ok', m.el).onclick = async () => {
            const ids = $$('[data-acc]', m.el).filter(c => c.checked).map(c => Number(c.dataset.acc));
            const r = await POST(`/imports/${l.id}/distribute`, { account_ids: ids }); toast(`Repartidos ${r.distributed} leads ✓`, 'ok'); m.close(); renderLists(); refreshCounters();
          };
        }
        if (b.dataset.a === 'del') {
          if (!await confirmBox(`¿Borrar la lista «${l.name}»? Solo se borran los leads que nunca contactaste; las conversaciones se conservan.`, 'Borrar lista', true)) return;
          const r = await DEL(`/imports/${l.id}`); toast(`Lista borrada. Se eliminaron ${r.deleted} leads sin contactar.`); renderLists(); renderSearch(); refreshCounters();
        }
      };
    }

    const sf = { q: '', stage: '', import_id: '', account_id: '', page: 0 };
    async function renderSearch() {
      const box = $('#search', el);
      const [lists, accs] = await Promise.all([GET(`/imports?channel=${ch}`), ch === 'whatsapp' ? GET('/accounts') : GET('/ig/accounts')]);
      const stages = ch === 'whatsapp' ? state.meta.stages : state.meta.ig_statuses;
      box.innerHTML = `<div class="glass pad"><h2>Buscar leads</h2>
        <div class="row" style="margin-bottom:12px">
          <input type="search" id="s-q" placeholder="${ch === 'whatsapp' ? 'Nombre, número, rubro, notas' : '@usuario, nombre, notas'}" value="${esc(sf.q)}" style="flex:1;min-width:200px">
          <select id="s-st"><option value="">Todas las etapas</option>${stages.map(s => `<option value="${s.id}" ${s.id === sf.stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
          <select id="s-li"><option value="">Todas las listas</option>${lists.map(l => `<option value="${l.id}" ${String(l.id) === sf.import_id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
          <select id="s-ac"><option value="">Todas las cuentas</option>${accs.map(a => `<option value="${a.id}" ${String(a.id) === sf.account_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
        </div><div id="s-res"></div></div>`;
      const run = async () => {
        const q = new URLSearchParams({ limit: 50, page: sf.page, ...(sf.q && { q: sf.q }), ...(sf.stage && { [ch === 'whatsapp' ? 'stage' : 'status']: sf.stage }), ...(sf.import_id && { import_id: sf.import_id }), ...(sf.account_id && { account_id: sf.account_id }) });
        const r = await GET((ch === 'whatsapp' ? '/contacts?' : '/ig?') + q);
        const res = $('#s-res', box);
        res.innerHTML = r.rows.length ? `<table class="t"><thead><tr>${ch === 'whatsapp' ? '<th>Nombre</th><th>Número</th><th>Etapa</th><th>Lista</th><th>Cuenta</th><th>Actividad</th>' : '<th>Usuario</th><th>Nombre</th><th>Estado</th><th>Lista</th><th>Cuenta</th><th>Actividad</th>'}</tr></thead><tbody>
          ${r.rows.map(c => ch === 'whatsapp'
            ? `<tr class="click" data-id="${c.id}"><td><b>${esc(c.name || '—')}</b>${c.has_wa === 0 ? ' <span class="pill bad">sin WhatsApp</span>' : ''}</td><td class="mono">${esc(c.phone_pretty)}</td><td><span class="pill">${esc(stageLabel(c.stage))}</span></td><td>${esc(c.import_name || '—')}</td><td>${esc(c.account_name || '—')}</td><td class="mut">${rel(Math.max(c.last_in_at || 0, c.last_out_at || 0)) || '—'}</td></tr>`
            : `<tr class="click" data-id="${c.id}"><td><b>@${esc(c.username)}</b></td><td>${esc(c.name || '')}</td><td><span class="pill">${esc(igLabel(c.status))}</span></td><td>${esc(c.import_name || '—')}</td><td>${esc(c.account_name || '—')}</td><td class="mut">${rel(c.last_contact_at) || '—'}</td></tr>`).join('')}
          </tbody></table><div class="row" style="margin-top:12px"><span class="mut small">${r.total} resultados</span><span class="spacer"></span><button class="btn sm" id="pp" ${sf.page ? '' : 'disabled'}>‹ Anterior</button><button class="btn sm" id="pn" ${(sf.page + 1) * 50 < r.total ? '' : 'disabled'}>Siguiente ›</button></div>`
          : '<p class="mut">No hay resultados.</p>';
        const pp = $('#pp', res), pn = $('#pn', res);
        if (pp) pp.onclick = () => { sf.page--; run(); }; if (pn) pn.onclick = () => { sf.page++; run(); };
        res.onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (!tr) return; ch === 'whatsapp' ? go(`#/whatsapp/chats?c=${tr.dataset.id}`) : igFicha(Number(tr.dataset.id), run); };
      };
      const on = (id, k) => ($(`#${id}`, box).onchange = e => { sf[k] = e.target.value; sf.page = 0; run(); });
      on('s-st', 'stage'); on('s-li', 'import_id'); on('s-ac', 'account_id');
      let qt; $('#s-q', box).oninput = e => { clearTimeout(qt); qt = setTimeout(() => { sf.q = e.target.value.trim(); sf.page = 0; run(); }, 250); };
      await run();
    }
    state.settings = await GET('/settings');
    setCh(ch);
  };

  // =================== Pantalla: Mensajes ===================
  VIEWS.mensajes = async (el, sub, params) => {
    let ch = params.ch === 'instagram' ? 'instagram' : 'whatsapp', mk = 'all';
    state.settings = await GET('/settings');
    const seq = String(state.settings.seq_days || '').split(',').map(Number);
    el.innerHTML = `<div class="head"><div class="grow"><h1>Mensajes</h1><p class="sub" style="margin:0">Cada tipo puede tener varias variantes: la app elige una al azar para cada lead.</p></div>
      <div class="subtabs" id="ch"><button data-c="whatsapp">WhatsApp</button><button data-c="instagram">Instagram</button></div></div>
      <div class="row" style="margin-bottom:14px"><span class="lab">Mercado:</span><div class="subtabs" id="mk"><button data-m="all" class="on">Todos</button>${state.meta.markets.map(x => `<button data-m="${x.id}">${marketLabel(x.id)}</button>`).join('')}</div></div>
      <div class="glass pad help" style="margin-bottom:16px"><b style="color:var(--txt)">Ayuda.</b> Variantes al azar: <code>{Hola|Buenas|Qué tal}</code>. Variables: <code>{{nombre}}</code> (vacío si parece un negocio), <code>{{nombre_coma}}</code> («, Juan» o nada), <code>{{negocio}}</code>, <code>{{rubro}}</code>, <code>{{ciudad}}</code>, <code>{{link_reunion}}</code> (tu link de Calendly).</div>
      <div id="tpls"></div>`;
    $('#ch', el).onclick = e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) { ch = c; load(); } };
    $('#mk', el).onclick = e => { const m = e.target.closest('[data-m]')?.dataset.m; if (m) { mk = m; $$('#mk button', el).forEach(b => b.classList.toggle('on', b.dataset.m === m)); load(); } };
    async function load() {
      $$('#ch button', el).forEach(b => b.classList.toggle('on', b.dataset.c === ch));
      const tpls = await GET(`/templates?channel=${ch}`);
      const kinds = state.meta.template_kinds[ch];
      $('#tpls', el).innerHTML = kinds.map(k => {
        const list = tpls.filter(t => t.kind === k.id && (mk === 'all' || t.market === mk));
        const days = k.step ? seq[k.step - 1] : null;
        return `<div class="glass pad" style="margin-bottom:14px">
          <div class="row" style="margin-bottom:10px"><h3 style="margin:0">${esc(k.label)}</h3>${days ? `<span class="pill acc">sale ${days} día${days > 1 ? 's' : ''} después del anterior</span>` : ''}${k.id === 'seg_no' ? `<span class="pill acc">sale ${esc(state.settings.fu_no_days)} días después del "no"</span>` : ''}<span class="spacer"></span><button class="btn sm" data-new="${k.id}">+ Agregar variante</button></div>
          <div class="col">${list.length ? list.map(t => `<div class="tpl"><div class="row"><b class="small">${esc(t.name || 'Variante')}</b><span class="pill">${marketLabel(t.market)}</span>${t.rubro ? `<span class="pill acc">${esc(t.rubro)}</span>` : '<span class="pill">todos los rubros</span>'}<span class="spacer"></span><button class="btn xs" data-ed="${t.id}">Editar</button><button class="btn xs bad" data-del="${t.id}">Borrar</button></div><div class="body">${esc(t.body)}</div></div>`).join('') : '<p class="mut small">Sin variantes en este mercado.</p>'}</div></div>`;
      }).join('');
      $('#tpls', el).onclick = async e => {
        const n = e.target.closest('[data-new]'), ed = e.target.closest('[data-ed]'), del = e.target.closest('[data-del]');
        if (n) editor({ kind: n.dataset.new, channel: ch, market: mk === 'all' ? 'co_mx' : mk, rubro: '', body: '', name: '' });
        if (ed) editor(tpls.find(t => String(t.id) === ed.dataset.ed));
        if (del && await confirmBox('¿Borrar esta variante?', 'Borrar', true)) { await DEL(`/templates/${del.dataset.del}`); load(); }
      };
    }
    function editor(t) {
      const kinds = state.meta.template_kinds[t.channel || ch];
      const m = modal(`<h2>${t.id ? 'Editar' : 'Nueva'} variante</h2>
        <div class="grid g2"><label class="f">Nombre<input type="text" id="e-n" value="${esc(t.name || '')}"></label>
        <label class="f">Tipo<select id="e-k">${kinds.map(k => `<option value="${k.id}" ${k.id === t.kind ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
        <label class="f">Mercado<select id="e-m">${state.meta.markets.map(x => `<option value="${x.id}" ${x.id === t.market ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
        <label class="f">Rubro (vacío = sirve para todos)<input type="text" id="e-r" list="rubros2" value="${esc(t.rubro || '')}"><datalist id="rubros2">${RUBROS.map(r => `<option value="${r}">`).join('')}</datalist></label></div>
        <label class="f" style="margin-top:12px">Texto<textarea id="e-b" rows="4">${esc(t.body || '')}</textarea></label>
        <div class="lab" style="margin:14px 0 6px">Vista previa</div>
        <div class="col"><div class="tpl"><span class="mut tiny">Con nombre de persona (Juan Pérez):</span><div class="body" id="p1"></div></div>
        <div class="tpl"><span class="mut tiny">Con nombre de negocio (Clínica Dermalux):</span><div class="body" id="p2"></div></div></div>
        <div class="help" style="margin-top:10px"><code>{a|b}</code> elige una opción · <code>{{nombre}}</code> <code>{{nombre_coma}}</code> <code>{{negocio}}</code> <code>{{rubro}}</code> <code>{{ciudad}}</code> <code>{{link_reunion}}</code></div>
        <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="e-ok">Guardar</button></div>`, { wide: true });
      const prev = async () => {
        const body = $('#e-b', m.el).value, market = $('#e-m', m.el).value, rubro = $('#e-r', m.el).value || 'Clínicas y estética';
        const [a, b] = await Promise.all([
          POST('/templates/preview', { body, market, contact: { name: 'Juan Pérez', rubro, city: 'Bogotá' } }, { quiet: true }),
          POST('/templates/preview', { body, market, contact: { name: 'Clínica Dermalux', rubro, city: 'Bogotá' } }, { quiet: true }),
        ]).catch(() => [{ text: '' }, { text: '' }]);
        if ($('#p1', m.el)) { $('#p1', m.el).textContent = a.text; $('#p2', m.el).textContent = b.text; }
      };
      let pt; $('#e-b', m.el).oninput = () => { clearTimeout(pt); pt = setTimeout(prev, 200); };
      $('#e-m', m.el).onchange = prev; prev();
      $('#e-ok', m.el).onclick = async () => {
        const body = { name: $('#e-n', m.el).value, kind: $('#e-k', m.el).value, market: $('#e-m', m.el).value, rubro: $('#e-r', m.el).value, body: $('#e-b', m.el).value, channel: t.channel || ch };
        if (!body.body.trim()) return toast('Escribe el texto.', 'warn');
        if (t.id) await PATCH(`/templates/${t.id}`, body); else await POST('/templates', body);
        toast('Guardado ✓', 'ok'); m.close(); load();
      };
    }
    await load();
  };

  // =================== Pantalla: Métricas ===================
  VIEWS.metricas = async (el) => {
    const d = await GET('/metrics');
    const f = d.funnel, ig = d.instagram;
    const steps = [['Contactados', f.contactados], ['Respondieron', f.respondieron], ['Pitch enviado', f.pitch], ['Interesados', f.interesados], ['Reuniones', f.reuniones], ['Ganados', f.ganados]];
    const max = Math.max(1, f.contactados);
    const maxDay = Math.max(1, ...d.days.map(x => Math.max(x.enviados, x.recibidos)));
    const rateTbl = (rows, first) => rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>${first}</th><th class="num">Contact.</th><th class="num">Resp.</th><th class="num">%</th><th class="num">Interés</th><th class="num">Reun.</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.name || r.rubro)}${r.market ? ` <span class="pill">${marketLabel(r.market)}</span>` : ''}</td><td class="num">${r.contactados}</td><td class="num">${r.respondieron}</td><td class="num"><b>${r.tasa_respuesta} %</b></td><td class="num">${r.interesados}</td><td class="num">${r.reuniones}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut small">Todavía no hay datos.</p>';
    el.innerHTML = `<div class="head"><div class="grow"><h1>Métricas</h1><p class="sub" style="margin:0">Todo cuenta por hitos: un lead que llegó a reunión también cuenta como que respondió.</p></div>
      <button class="btn" data-export="edition">⬇ Exportar para la app EDITION</button></div>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="glass kpi"><div class="lab">Tasa de respuesta</div><div class="v">${f.tasa_respuesta} %</div><div class="s">${f.respondieron} de ${f.contactados} contactados</div></div>
        <div class="glass kpi"><div class="lab">Tasa de interés</div><div class="v">${f.tasa_interes} %</div><div class="s">de los que respondieron</div></div>
        <div class="glass kpi"><div class="lab">Tasa de reunión</div><div class="v">${f.tasa_reunion} %</div><div class="s">${f.reuniones} reuniones</div></div>
      </div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="glass pad-l"><h2>Embudo de WhatsApp</h2>
          ${steps.map(([l, v]) => `<div style="margin:10px 0"><div class="row small"><span>${l}</span><span class="spacer"></span><b>${v}</b></div><div class="bar"><i style="width:${v / max * 100}%"></i></div></div>`).join('')}
          <div class="row small mut" style="margin-top:12px;gap:16px"><span>No interesados: <b style="color:var(--txt)">${f.no_interesados}</b></span><span>Sin WhatsApp: <b style="color:var(--txt)">${f.sin_whatsapp}</b></span></div></div>
        <div class="glass pad-l"><h2>Últimos 14 días</h2>
          <div class="legend"><span><i style="background:var(--brand)"></i>Primeros mensajes</span><span><i style="background:var(--acc)"></i>Enviados (todos)</span><span><i style="background:var(--ok)"></i>Recibidos</span></div>
          <div class="chart">${d.days.map(x => `<div class="c" title="${fmtDate(x.day)}: ${x.saludos} primeros, ${x.enviados} enviados, ${x.recibidos} recibidos"><div class="bars"><i style="height:${x.saludos / maxDay * 100}%;background:var(--brand)"></i><i style="height:${x.enviados / maxDay * 100}%;background:var(--acc)"></i><i style="height:${x.recibidos / maxDay * 100}%;background:var(--ok)"></i></div><span class="lbl">${new Date(x.day).getDate()}</span></div>`).join('')}</div></div>
      </div>
      <div class="glass pad-l" style="margin-bottom:16px"><h2>Por cuenta</h2>${rateTbl(d.byAccount, 'Cuenta')}</div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="glass pad-l"><h2>Por rubro</h2>${rateTbl(d.byRubro, 'Rubro')}</div>
        <div class="glass pad-l"><h2>Por plantilla de saludo</h2>${rateTbl(d.byTemplate, 'Plantilla')}</div>
      </div>
      <div class="glass pad-l"><h2>Instagram</h2>
        <div class="grid g4" style="margin-bottom:14px">
          <div class="kpi"><div class="lab">Contactados</div><div class="v">${ig.funnel.contactados}</div></div>
          <div class="kpi"><div class="lab">Respondieron</div><div class="v">${ig.funnel.respondieron}</div><div class="s">${ig.funnel.tasa_respuesta} %</div></div>
          <div class="kpi"><div class="lab">Reuniones</div><div class="v">${ig.funnel.reuniones}</div><div class="s">${ig.funnel.tasa_reunion} %</div></div>
          <div class="kpi"><div class="lab">Cerrados</div><div class="v">${ig.funnel.cerrados}</div></div></div>
        ${ig.byAccount.length ? `<table class="t"><thead><tr><th>Cuenta</th><th class="num">Contactados</th><th class="num">Respondieron</th><th class="num">% resp.</th><th class="num">Reuniones</th><th class="num">Descartados</th></tr></thead><tbody>
          ${ig.byAccount.map(a => `<tr><td><span class="dot" style="background:${esc(a.color)}"></span> ${esc(a.name)}</td><td class="num">${a.contactados}</td><td class="num">${a.respondieron}</td><td class="num"><b>${a.tasa_respuesta} %</b></td><td class="num">${a.reuniones}</td><td class="num">${a.descartados}</td></tr>`).join('')}</tbody></table>` : '<p class="mut small">Todavía no hay cuentas de Instagram.</p>'}</div>`;
  };

  // =================== Pantalla: Cuentas WhatsApp ===================
  VIEWS.cuentas_wa = async (el) => {
    async function load() {
      const accs = await GET('/accounts');
      el.innerHTML = `<div class="head"><div class="grow"><h1>Cuentas WhatsApp</h1><p class="sub" style="margin:0">Los números con los que prospectas. Cada uno tiene su cupo diario de primeros mensajes.</p></div>
        <button class="btn primary" id="add">+ Agregar número</button></div>
        ${accs.length ? `<div class="grid g2">${accs.map(a => `<div class="glass pad-l" data-acc="${a.id}">
          <div class="row"><span class="dot ok"></span><h2 style="margin:0">${esc(a.name)}</h2>${a.active_here ? '<span class="pill ok">trabajando aquí</span>' : ''}<span class="spacer"></span><span class="mono small mut">${a.phone ? esc(a.phone) : ''}</span></div>
          <div class="row" style="margin:14px 0"><span class="small">Enviados hoy: <b>${a.sent_today}</b> /</span>
            <label class="row small">Cupo diario <input type="number" min="1" max="200" value="${a.daily_limit}" data-limit="${a.id}" style="width:80px"></label>
            <span class="mut small">${a.pending} pendientes</span></div>
          <div class="row">${a.active_here ? '' : '<button class="btn sm" data-a="use">Usar esta</button>'}<button class="btn sm" data-a="edit">Editar</button><span class="spacer"></span><button class="btn sm bad" data-a="del">Borrar</button></div>
        </div>`).join('')}</div>` : `<div class="glass">${emptyState('📱', 'Agrega tu número de WhatsApp', 'Ponle un nombre (por ejemplo, EDITION 1) y el cupo diario. El mensaje se abre en el WhatsApp del dispositivo que estés usando.', '', '')}</div>`}
        <div class="banner info" style="margin-top:18px">🛡️ Para no quemar el número: empieza con 10–15 primeros mensajes por día y sube de a poco. Usa varias variantes de saludo y respeta la pausa entre mensajes.</div>
        <div class="banner warn">📱 Usa el mismo número en el celular y en la PC (WhatsApp Web o la app de escritorio vinculada) para que cada chat se abra con la cuenta correcta.</div>`;
      $('#add', el).onclick = () => edit({});
      $$('[data-limit]', el).forEach(i => (i.onchange = async () => { await PATCH(`/accounts/${i.dataset.limit}`, { daily_limit: Number(i.value) }); toast('Cupo guardado ✓', 'ok'); }));
      $$('[data-acc]', el).forEach(card => (card.onclick = async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const acc = accs.find(x => String(x.id) === card.dataset.acc);
        if (a === 'use') { await PATCH('/settings', { wa_active_account: acc.id }); load(); refreshCounters(); }
        if (a === 'edit') edit(acc);
        if (a === 'del' && await confirmBox('¿Borrar esta cuenta? Las conversaciones y los leads se conservan.', 'Borrar cuenta', true)) { await DEL(`/accounts/${acc.id}`); load(); refreshCounters(); }
      }));
    }
    function edit(a) {
      const m = modal(`<h2>${a.id ? 'Editar número' : 'Nuevo número de WhatsApp'}</h2>
        <label class="f">Nombre<input type="text" id="n" value="${esc(a.name || '')}" placeholder="EDITION 1"></label>
        <label class="f" style="margin-top:12px">Número (opcional, para que lo reconozcas)<input type="text" id="ph" value="${esc(a.phone || '')}" placeholder="+57 300 000 0000"></label>
        <label class="f" style="margin-top:12px">Primeros mensajes por día<input type="number" id="l" value="${a.daily_limit || 15}" min="1"></label>
        <p class="small mut">Si el número es nuevo, lo seguro es 10–15.</p>
        <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button></div>`);
      $('#n', m.el).focus();
      $('#ok', m.el).onclick = async () => {
        const body = { name: $('#n', m.el).value, phone: $('#ph', m.el).value, daily_limit: Number($('#l', m.el).value) };
        if (a.id) await PATCH(`/accounts/${a.id}`, body); else await POST('/accounts', body);
        m.close(); load(); refreshCounters();
      };
    }
    await load();
  };

  // =================== Pantalla: Cuentas Instagram ===================
  VIEWS.cuentas_ig = async (el) => {
    async function load() {
      const accs = await GET('/ig/accounts'); state.igAccounts = accs;
      el.innerHTML = `<div class="head"><div class="grow"><h1>Cuentas Instagram</h1><p class="sub" style="margin:0">Tus cuentas de prospección. Los perfiles se abren en la app de Instagram del celular o en tu navegador.</p></div>
        <button class="btn primary" id="add">+ Agregar cuenta</button></div>
        ${accs.length ? `<div class="grid g2">${accs.map(a => `<div class="glass pad-l" data-acc="${a.id}">
          <div class="row"><span class="dot" style="background:${/^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : '#2563EB'}"></span><h2 style="margin:0">${esc(a.name)}</h2>${a.username ? `<span class="mut">@${esc(a.username)}</span>` : ''}<span class="spacer"></span>${a.active_here ? '<span class="pill ok">trabajando aquí</span>' : ''}</div>
          <div class="row small" style="margin:12px 0">Enviados hoy: <b>${a.sent_today}</b> / ${a.daily_limit}<span class="mut">· ${a.pending} pendientes · ${a.followups} seguimientos</span></div>
          ${a.notes ? `<p class="small mut">${esc(a.notes)}</p>` : ''}
          <div class="row">${a.active_here ? '' : '<button class="btn primary sm" data-a="use">Usar esta</button>'}<button class="btn sm" data-a="edit">Editar</button><span class="spacer"></span><button class="btn sm bad" data-a="del">Borrar</button></div>
        </div>`).join('')}</div>` : `<div class="glass">${emptyState('📸', 'Agrega tu cuenta de Instagram', 'Ponle un nombre, tu @usuario y el cupo diario.', '', '')}</div>`}
        <div class="banner info" style="margin-top:18px">🛡️ El CRM nunca envía, sigue ni da likes: solo copia el mensaje y abre el perfil. Respeta el cupo diario.</div>
        <div class="banner warn">Si tienes varias cuentas de Instagram, antes de prospectar confirma en la app de Instagram que estás en la cuenta correcta.</div>`;
      $('#add', el).onclick = () => edit({});
      $$('[data-acc]', el).forEach(card => (card.onclick = async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const acc = accs.find(x => String(x.id) === card.dataset.acc);
        if (a === 'use') { await PATCH('/settings', { ig_active_account: acc.id }); load(); refreshCounters(); }
        if (a === 'edit') edit(acc);
        if (a === 'del' && await confirmBox(`¿Borrar la cuenta ${acc.name}? Los leads se conservan.`, 'Borrar', true)) { await DEL(`/ig/accounts/${acc.id}`); load(); refreshCounters(); }
      }));
    }
    function edit(a) {
      const m = modal(`<h2>${a.id ? 'Editar cuenta' : 'Nueva cuenta de Instagram'}</h2>
        <div class="grid g2"><label class="f">Nombre<input type="text" id="n" value="${esc(a.name || '')}" placeholder="EDITION IG 1"></label>
        <label class="f">Usuario<input type="text" id="u" value="${esc(a.username ? '@' + a.username : '')}" placeholder="@usuario"></label>
        <label class="f">Primeros mensajes por día<input type="number" id="l" value="${a.daily_limit || 30}" min="1"></label>
        <label class="f">Color<input type="color" id="c" value="${/^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : '#2563EB'}" style="height:42px;width:100%;background:var(--input);border:1px solid var(--line-2);border-radius:10px"></label></div>
        <label class="f" style="margin-top:12px">Notas<textarea id="no" rows="2">${esc(a.notes || '')}</textarea></label>
        <div class="foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button></div>`);
      $('#ok', m.el).onclick = async () => {
        const body = { name: $('#n', m.el).value, username: $('#u', m.el).value, daily_limit: Number($('#l', m.el).value), color: $('#c', m.el).value, notes: $('#no', m.el).value };
        if (a.id) await PATCH(`/ig/accounts/${a.id}`, body); else await POST('/ig/accounts', body);
        m.close(); load(); refreshCounters();
      };
    }
    await load();
  };

  // =================== Pantalla: Ajustes ===================
  VIEWS.ajustes = async (el) => {
    const s = await GET('/settings'); state.settings = s;
    const seq = String(s.seq_days).split(',');
    const days = String(s.work_days).split(',');
    const DN = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    el.innerHTML = `<h1>Ajustes</h1><p class="sub">Los cambios se guardan al tocar "Guardar".</p>
      <div class="grid g2">
        <div class="glass pad-l"><h2>Seguimientos</h2><p class="small mut">Días después del mensaje anterior para cada paso. Cuenta días de calendario: "2" es pasado mañana desde las 00:00.</p>
          <div class="row">${[0, 1, 2, 3, 4].map(i => `<label class="f" style="width:70px">Paso ${i + 1}<input type="number" min="1" data-seq="${i}" value="${esc(seq[i] || '')}"></label>`).join('')}</div>
          <label class="f" style="margin-top:14px">Retomar a los que dijeron que no, a los N días (mínimo 1)<input type="number" min="1" id="fno" value="${esc(s.fu_no_days)}" style="width:110px"></label></div>
        <div class="glass pad-l"><h2>WhatsApp</h2><p class="small mut">Pausa al azar entre un primer mensaje y el siguiente, por cuenta. Ayuda a que el número no parezca un robot.</p>
          <div class="row"><label class="f">Mínima (segundos)<input type="number" min="10" id="mn" value="${esc(s.min_delay_sec)}" style="width:120px"></label><label class="f">Máxima (segundos)<input type="number" min="10" id="mx" value="${esc(s.max_delay_sec)}" style="width:120px"></label></div>
          <label class="f" style="margin-top:14px">Avisarme para empujar la reunión si un interesado no se mueve en (horas)<input type="number" min="1" id="mp" value="${esc(s.meeting_push_hours)}" style="width:110px"></label></div>
        <div class="glass pad-l"><h2>Horario</h2><p class="small mut">Fuera de este horario la app te avisa, pero no te bloquea.</p>
          <div class="row"><label class="f">Inicio<input type="time" id="ws" value="${esc(s.work_start)}"></label><label class="f">Fin<input type="time" id="we" value="${esc(s.work_end)}"></label></div>
          <div class="stage-btns" id="wd" style="margin-top:14px">${DN.map((d, i) => `<button data-d="${i + 1}" class="${days.includes(String(i + 1)) ? 'on' : ''}">${d}</button>`).join('')}</div></div>
        <div class="glass pad-l"><h2>País y agenda</h2><p class="small mut">El país por defecto se usa para los números que vienen sin código. Al importar puedes elegir otro.</p>
          <label class="f">País por defecto<select id="cc">${state.meta.countries.map(c => `<option value="${c.cc}" ${c.cc === s.country_code ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
          <label class="f" style="margin-top:14px">Tu link de agenda (Calendly)<input type="url" id="cal" value="${esc(s.calendly_url)}" placeholder="https://calendly.com/tu-usuario/15min"></label>
          <p class="small mut">Aparece como botón "Insertar mi link de agenda" y en la variable {{link_reunion}}.</p></div>
        <div class="glass pad-l"><h2>Mover de etapa según lo que responden</h2><p class="small mut">Si dicen "no me interesa" pasan a No interesado; si dicen "me interesa" o preguntan precio, a Interesado.</p>
          <div class="subtabs" id="ac"><button data-v="1" class="${s.auto_classify === '1' ? 'on' : ''}">Sí</button><button data-v="0" class="${s.auto_classify !== '1' ? 'on' : ''}">No</button></div></div>
        <div class="glass pad-l"><h2>Tu cuenta y tus datos</h2><p class="small mut">Tus datos viven en tu proyecto de Supabase y se sincronizan entre la PC y el celular. Descarga una copia en CSV de vez en cuando.</p>
          <p class="small">Sesión iniciada como <b>${esc(state.email || '')}</b></p>
          <div class="row"><button class="btn sm" data-export="whatsapp">Exportar WhatsApp (CSV)</button><button class="btn sm" data-export="instagram">Exportar Instagram (CSV)</button><button class="btn sm" data-export="edition">Exportar para la app EDITION</button></div>
          <div class="row" style="margin-top:12px"><button class="btn sm bad" id="logout">Cerrar sesión en este dispositivo</button></div></div>
      </div>
      <div style="margin-top:18px"><button class="btn primary big" id="save">Guardar ajustes</button></div>`;
    $('#logout', el).onclick = async () => { if (await confirmBox('¿Cerrar sesión en este dispositivo?', 'Cerrar sesión')) { await SB.auth.signOut(); location.hash = ''; location.reload(); } };
    $('#wd', el).onclick = e => { const b = e.target.closest('[data-d]'); if (b) b.classList.toggle('on'); };
    $('#ac', el).onclick = e => { const b = e.target.closest('[data-v]'); if (b) $$('#ac button', el).forEach(x => x.classList.toggle('on', x === b)); };
    $('#save', el).onclick = async () => {
      const body = {
        seq_days: $$('[data-seq]', el).map(i => i.value || '1').join(','), fu_no_days: $('#fno', el).value,
        min_delay_sec: $('#mn', el).value, max_delay_sec: $('#mx', el).value, meeting_push_hours: $('#mp', el).value,
        work_start: $('#ws', el).value, work_end: $('#we', el).value,
        work_days: $$('#wd button.on', el).map(b => b.dataset.d).join(','),
        country_code: $('#cc', el).value, calendly_url: $('#cal', el).value.trim(),
        auto_classify: $('#ac button.on', el)?.dataset.v || '1',
      };
      if (Number(body.min_delay_sec) > Number(body.max_delay_sec)) return toast('La pausa mínima no puede ser mayor que la máxima.', 'warn');
      state.settings = await PATCH('/settings', body); toast('Ajustes guardados ✓', 'ok'); VIEWS.ajustes(el);
    };
  };

  // =================== Inicio de sesión ===================
  let SB = null;
  function showLogin(msg = '') {
    document.body.classList.add('login-mode');
    let box = $('#login');
    if (!box) { box = document.createElement('div'); box.id = 'login'; document.body.appendChild(box); }
    box.innerHTML = `<div class="login-card glass">
      <div class="brand" style="padding:0 0 18px"><img src="logo.png" alt=""><div><b>EDITION</b><small>CRM de prospección</small></div></div>
      <h1 style="font-size:22px">Iniciar sesión</h1><p class="sub">Entra con el email y la contraseña de tu usuario de Supabase.</p>
      ${msg ? `<div class="banner warn">${esc(msg)}</div>` : ''}
      <form id="lf" class="col">
        <label class="f">Email<input type="text" inputmode="email" autocomplete="username" id="le" required></label>
        <label class="f">Contraseña<input type="password" autocomplete="current-password" id="lp" required style="background:var(--input);border:1px solid var(--line-2);border-radius:10px;padding:9px 12px"></label>
        <button class="btn primary big" type="submit" id="lb">Entrar</button>
      </form>
      <p class="tiny mut" style="margin-top:14px">Acceso privado. Tus datos solo los ves tú.</p></div>`;
    $('#lf').onsubmit = async (e) => {
      e.preventDefault();
      const b = $('#lb'); b.disabled = true; b.textContent = 'Entrando…';
      const { error } = await SB.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value });
      if (error) { b.disabled = false; b.textContent = 'Entrar'; toast(/Invalid login/i.test(error.message) ? 'Email o contraseña incorrectos.' : 'No se pudo entrar: ' + error.message, 'bad'); return; }
      location.reload();
    };
  }

  // =================== Arranque ===================
  async function start() {
    const cfg = window.CRM_CONFIG || {};
    if (!window.supabase || !cfg.supabaseUrl || /TU-PROYECTO|TU-ANON/.test(cfg.supabaseUrl + cfg.supabaseKey)) {
      $('#main').innerHTML = '<div class="view"><div class="glass pad-l" style="max-width:560px;margin:60px auto"><h2>Falta configurar Supabase</h2><p class="mut">Abre <b>config.js</b> y pon la Project URL y la anon key de tu proyecto.</p></div></div>';
      return;
    }
    SB = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'edition-crm-auth' } });
    const { data: { session } } = await SB.auth.getSession();
    if (!session) return showLogin();
    state.email = session.user?.email || '';
    SB.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') showLogin(); });
    DATA = createData(SB);
    try { await DATA.ensureSeed(); } catch (e) { toast(e.message || 'No se pudo cargar tu información.', 'bad'); }
    state.meta = META;
    state.settings = await GET('/settings').catch(() => ({}));
    $('#side-foot').textContent = `Versión ${state.meta.version} · ${state.email}`;
    window.addEventListener('hashchange', route);
    startEvents();
    refreshCounters();
    route();
  }

  return { start, toast, state, api, go };
})();
window.App = App;
App.start();
