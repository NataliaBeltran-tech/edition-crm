// Plantillas iniciales (DECISIONES.md). Se cargan la primera vez que entras.
// Mercados: co_mx (español neutro, tú) · es (España) · us (inglés)
const W = 'whatsapp', I = 'instagram';
const t = (channel, market, kind, name, body) => ({ channel, market, kind, name, body });

export const SEED_TEMPLATES = [
  // ===== WhatsApp · español neutro =====
  t(W, 'co_mx', 'saludo', 'Saludo A', '{Hola|Buenas|Hola, buenas}{{nombre_coma}}! ¿Cómo {vas|va todo|estás}?'),
  t(W, 'co_mx', 'saludo', 'Saludo B', '{Hola|Buen día}{{nombre_coma}}, ¿cómo estás? {Te hago una consulta rápida|Una pregunta corta}'),
  t(W, 'co_mx', 'pitch', 'Pitch', 'Te cuento rápido: soy Natalia, de EDITION. Editamos reels y videos para redes con gancho, ritmo y subtítulos, en packs mensuales con entrega en 48 h. ¿Hoy quién se encarga de editar tus videos?'),
  t(W, 'co_mx', 'pitch', 'Pitch (variante)', 'Soy Natalia, de EDITION: somos un equipo de edición que trabaja con {{rubro}}. Convertimos tus grabaciones en reels con gancho y subtítulos, con entrega en 48 h, para que publiques con constancia sin pasar horas editando. ¿Hoy editas tú o te ayuda alguien?'),
  t(W, 'co_mx', 'reunion', 'Llevar a la reunión', 'Genial{{nombre_coma}}. ¿Te queda bien una llamada de 15 minutos para mostrarte ejemplos y cómo trabajamos? Dime qué día y horario te sirve.'),
  t(W, 'co_mx', 'seg1_saludo', 'Seguimiento 1 (no respondió el saludo)', '{{nombre}} ¿te puedo escribir un momento?'),
  t(W, 'co_mx', 'seg1_saludo', 'Seguimiento 1 (no respondió el saludo) B', '¿Tienes un minuto{{nombre_coma}}? Es algo cortito.'),
  t(W, 'co_mx', 'seg1', 'Seguimiento 1', '{¿Pudiste ver lo que te mandé|¿Alcanzaste a leer lo que te escribí}{{nombre_coma}}?'),
  t(W, 'co_mx', 'seg2', 'Seguimiento 2', '{{nombre}} ¿lo pudiste pensar? Si quieres, te muestro 2 ejemplos de reels que editamos.'),
  t(W, 'co_mx', 'seg3', 'Seguimiento 3', '¿{Sigues por ahí|Me leíste}{{nombre_coma}}? Te escribo cortito.'),
  t(W, 'co_mx', 'seg4', 'Seguimiento 4', '{{nombre}} ¿te sirve que te mande un ejemplo de lo que hacemos para {{rubro}}?'),
  t(W, 'co_mx', 'seg5', 'Seguimiento 5', 'Último mensaje para no molestarte{{nombre_coma}}. Si más adelante quieres delegar la edición de tus videos, escríbeme y lo vemos.'),
  t(W, 'co_mx', 'seg_no', 'Seguimiento a un "no"', '¡Hola{{nombre_coma}}! Hablamos hace un tiempo. ¿Cambió algo con la edición de tus videos? Estamos trabajando con varios {{rubro}} y quizá te sirva.'),

  // ===== WhatsApp · España =====
  t(W, 'es', 'saludo', 'Saludo A (ES)', '{Hola|Buenas|Hola, buenas}{{nombre_coma}}! ¿Qué tal {estás|va todo}?'),
  t(W, 'es', 'saludo', 'Saludo B (ES)', '{Hola|Buenos días}{{nombre_coma}}, ¿qué tal? {Te hago una consulta rápida|Una pregunta corta}'),
  t(W, 'es', 'pitch', 'Pitch (ES)', 'Te cuento rápido: soy Natalia, de EDITION. Editamos reels y vídeos para redes con gancho, ritmo y subtítulos, en packs mensuales con entrega en 48 h. ¿Hoy editas tú los vídeos o tenéis a alguien?'),
  t(W, 'es', 'reunion', 'Llevar a la reunión (ES)', 'Genial{{nombre_coma}}. ¿Te va bien una llamada de 15 minutos para enseñarte ejemplos y cómo trabajamos? Dime qué día y hora te viene bien.'),
  t(W, 'es', 'seg1_saludo', 'Seguimiento 1 (no respondió el saludo) (ES)', '{{nombre}} ¿te puedo escribir un momento?'),
  t(W, 'es', 'seg1', 'Seguimiento 1 (ES)', '{¿Pudiste ver lo que te envié|¿Llegaste a leer lo que te escribí}{{nombre_coma}}?'),
  t(W, 'es', 'seg2', 'Seguimiento 2 (ES)', '{{nombre}} ¿lo pudiste pensar? Si quieres, te enseño 2 ejemplos de reels que hemos editado.'),
  t(W, 'es', 'seg3', 'Seguimiento 3 (ES)', '¿{Sigues por ahí|Me leíste}{{nombre_coma}}? Te escribo cortito.'),
  t(W, 'es', 'seg4', 'Seguimiento 4 (ES)', '{{nombre}} ¿te vale que te envíe un ejemplo de lo que hacemos para {{rubro}}?'),
  t(W, 'es', 'seg5', 'Seguimiento 5 (ES)', 'Último mensaje para no molestarte{{nombre_coma}}. Si más adelante queréis delegar la edición, escríbeme y lo vemos.'),
  t(W, 'es', 'seg_no', 'Seguimiento a un "no" (ES)', '¡Hola{{nombre_coma}}! Hablamos hace un tiempo. ¿Ha cambiado algo con la edición de vuestros vídeos? Estamos trabajando con varios {{rubro}} y quizá os sirva.'),

  // ===== WhatsApp · inglés =====
  t(W, 'us', 'saludo', 'Greeting A (US)', `{Hi|Hey|Hello}{{nombre_coma}}! {How are you doing|Hope you're doing well}?`),
  t(W, 'us', 'saludo', 'Greeting B (US)', `{Hi|Hello}{{nombre_coma}}, {quick question|can I ask you something quick}?`),
  t(W, 'us', 'pitch', 'Pitch (US)', `Quick intro: I'm Natalia from EDITION. We edit reels and short-form videos with strong hooks, pacing and captions, in monthly packs with 48-hour delivery. Who's handling your video editing right now?`),
  t(W, 'us', 'reunion', 'Book the call (US)', `Great{{nombre_coma}}. Would a quick 15-minute call work to show you some examples and how we work? Let me know a day and time that suits you.`),
  t(W, 'us', 'seg1_saludo', 'Follow-up 1 (no reply to greeting) (US)', `{{nombre}} do you have a minute? It's something quick.`),
  t(W, 'us', 'seg1', 'Follow-up 1 (US)', `{Did you get a chance to see my message|Did you see what I sent}{{nombre_coma}}?`),
  t(W, 'us', 'seg2', 'Follow-up 2 (US)', `{{nombre}} any thoughts? Happy to show you 2 examples of reels we've edited.`),
  t(W, 'us', 'seg3', 'Follow-up 3 (US)', `{Still there|Are you still around}{{nombre_coma}}? Keeping it short.`),
  t(W, 'us', 'seg4', 'Follow-up 4 (US)', `{{nombre}} would it help if I sent you an example of what we do for {{rubro}}?`),
  t(W, 'us', 'seg5', 'Follow-up 5 (US)', `Last message so I don't bother you{{nombre_coma}}. If you ever want to hand off your editing, just message me.`),
  t(W, 'us', 'seg_no', 'Follow-up after a "no" (US)', `Hi{{nombre_coma}}! We talked a while ago. Has anything changed with your video editing? We're working with several {{rubro}} and it might be useful.`),

  // ===== Instagram · español neutro =====
  t(I, 'co_mx', 'first', 'Primer mensaje', '{¡Hola!|¡Buenas!} {Una pregunta rápida|Te hago una consulta corta}: ¿hoy editas tú tus reels o te ayuda alguien?'),
  t(I, 'co_mx', 'seg1', 'Seguimiento 1', '¿Pudiste ver mi mensaje? 🙌'),
  t(I, 'co_mx', 'seg2', 'Seguimiento 2', 'Te pregunto porque editamos reels para {{rubro}}: gancho, ritmo y subtítulos, con entrega en 48 h. ¿Te muestro 2 ejemplos?'),
  t(I, 'co_mx', 'seg3', 'Seguimiento 3', '¿Sigues por acá?'),
  t(I, 'co_mx', 'seg4', 'Seguimiento 4', '¿Te sirve que te cuente en 2 líneas cómo trabajamos?'),
  t(I, 'co_mx', 'seg5', 'Seguimiento 5', 'Último mensaje para no molestarte. Si más adelante te interesa, escríbeme.'),

  // ===== Instagram · España =====
  t(I, 'es', 'first', 'Primer mensaje (ES)', '{¡Hola!|¡Buenas!} {Una pregunta rápida|Te hago una consulta corta}: ¿hoy editas tú los reels o tenéis a alguien?'),
  t(I, 'es', 'seg1', 'Seguimiento 1 (ES)', '¿Pudiste ver mi mensaje? 🙌'),
  t(I, 'es', 'seg2', 'Seguimiento 2 (ES)', 'Te pregunto porque editamos reels para {{rubro}}: gancho, ritmo y subtítulos, con entrega en 48 h. ¿Te enseño 2 ejemplos?'),
  t(I, 'es', 'seg3', 'Seguimiento 3 (ES)', '¿Sigues por ahí?'),
  t(I, 'es', 'seg4', 'Seguimiento 4 (ES)', '¿Te vale que te cuente en 2 líneas cómo trabajamos?'),
  t(I, 'es', 'seg5', 'Seguimiento 5 (ES)', 'Último mensaje para no molestarte. Si más adelante os interesa, escríbeme.'),

  // ===== Instagram · inglés =====
  t(I, 'us', 'first', 'First message (US)', `{Hi!|Hey!} {Quick question|Can I ask you something quick}: are you editing your reels yourself right now, or does someone help you?`),
  t(I, 'us', 'seg1', 'Follow-up 1 (US)', `Did you get a chance to see my message? 🙌`),
  t(I, 'us', 'seg2', 'Follow-up 2 (US)', `I ask because we edit reels for {{rubro}}: hooks, pacing and captions, with 48-hour delivery. Want me to show you 2 examples?`),
  t(I, 'us', 'seg3', 'Follow-up 3 (US)', `Still around?`),
  t(I, 'us', 'seg4', 'Follow-up 4 (US)', `Would it help if I explained how we work in 2 lines?`),
  t(I, 'us', 'seg5', 'Follow-up 5 (US)', `Last message so I don't bother you. If you're interested later on, just message me.`),
];
