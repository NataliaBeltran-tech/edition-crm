# EDITION · CRM de prospección en la nube (PC + celular)

Esta es la versión del CRM que funciona en la PC y en el celular con los mismos datos. Lo que haces en un dispositivo aparece en el otro.
- **Datos e inicio de sesión:** en **tu proyecto de Supabase**.
- **La app:** una página web que se **instala como app** (PWA).
- **Ningún mensaje sale solo:** el CRM abre WhatsApp o Instagram con el mensaje listo, tú lo envías y vuelves para marcar **«Enviado ✓»**.

---

## 1. Configuración (una sola vez)

### a) Supabase
1. En tu proyecto de Supabase, abre **SQL Editor → New query**.
2. Pega **todo** el archivo `supabase/schema.sql` y toca **Run**. Puedes correrlo de nuevo sin miedo: solo crea lo que falta y nunca borra datos.
3. **Crea tu usuario:** ve a **Authentication → Users → Add user → Create new user**. Pon tu email y una contraseña segura, y marca **Auto Confirm User**.
4. **Cierra el registro público:** ve a **Authentication → Sign In / Providers** y desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta.
5. En **Project Settings → API**, copia la **Project URL** y la **anon / publishable key**.
   - Esas dos van en `web/config.js`.
   - La **service_role / secret key** nunca va en la app ni se comparte.

### b) Publicación (GitHub Pages, gratis)
- El código vive en tu repositorio `edition-crm` y la app queda en `https://TU-USUARIO.github.io/edition-crm/`.
- Cada vez que se sube un cambio, la página se actualiza sola en uno o dos minutos.

---

## 2. Instalarla como app

- **Celular Android (Chrome):** abre la dirección, entra con tu email y contraseña. Toca **⋮ → Agregar a la pantalla principal / Instalar app**.
- **iPhone (Safari):** abre la dirección y toca **Compartir → Agregar a inicio**.
- **PC (Chrome o Edge):** abre la dirección y toca el ícono **Instalar** (la pantallita con la flecha) a la derecha de la barra de direcciones. Queda como app con su ícono.

La sesión queda guardada en cada dispositivo. En **Ajustes** puedes cerrar la sesión de un dispositivo.

**WhatsApp en la PC:** usa **WhatsApp Desktop** o **WhatsApp Web** vinculado al **mismo número** que en el celular. Así «Abrir WhatsApp» abre el chat correcto en los dos.

---

## 3. El día a día

| Pantalla | Para qué sirve |
|---|---|
| **Hoy** | Lo que te falta en los dos canales: primeros mensajes, seguimientos, respuestas y la agenda (con el botón 📅 para pasar cada reunión a Google Calendar). |
| **WhatsApp → Contactar hoy** | Una tarjeta a la vez. **Abrir WhatsApp** abre el chat con el mensaje ya escrito: lo envías y vuelves para tocar **Enviado ✓**. Antes del siguiente hay una pausa al azar («Próximo en 2:31») para cuidar el número. **Otra variante** cambia el texto, **Saltear** lo deja para después, **No tiene WhatsApp** y **No sirve** lo descartan. |
| **WhatsApp → Seguimiento** | Tus tareas: *Te escribieron, Mandar pitch, Seguimiento (paso n/5), Llevar a la reunión, Reuniones próximas, Retomar un «no», Para cerrar*. Al tocar una se abre el chat con el mensaje sugerido. |
| **WhatsApp → Conversaciones** | Todos tus leads con actividad, agrupados por etapa. |
| **Instagram** | **Abrir Instagram** copia el mensaje y abre el perfil (en el celular, en la app de Instagram). Pegas el mensaje, lo envías y tocas **Enviado ✓**. Cuando te contesten, toca **Respondió**. |
| **Embudo** | WhatsApp e Instagram lado a lado. Tocas un lead y eliges la nueva etapa. |
| **Base de datos** | Para subir tus Excel o CSV (Google Maps, otros scrapers, tus listas de EDITION): eliges el mercado, el país y las cuentas, revisas la vista previa e importas. |
| **Mensajes** | Las plantillas con sus variantes en español neutro, España e inglés. |
| **Métricas** | Tasas de respuesta, interés y reunión. El botón **Exportar para la app EDITION** saca un CSV para tu app interna. |
| **Ajustes** | Días de seguimiento (2·3·4·7·14), cuándo retomar los «no» (30 días), pausas, horario, país, link de Calendly y la opción de cerrar sesión. |

**Cuando un lead te responde por WhatsApp:**
1. Abre su chat en el CRM.
2. Pega lo que te dijo en **«¿Te respondió?»** y toca **Respondió**.
3. El CRM mueve la etapa solo («me interesa» → Interesado, «no gracias» → No interesado) y corta la secuencia de seguimientos.

Si no quieres pegar el texto, toca **Respondió** igual.

---

## 4. Para no quemar cuentas

- **WhatsApp:** empieza con **10–15 primeros mensajes por número al día** y sube de a poco.
- Usa varias variantes de saludo, respeta la pausa entre mensajes y escribe en horario laboral.
- **Instagram:** respeta el cupo diario y, si el lead tiene historia activa, respóndele la historia.

---

## 5. Tus datos

- Todo vive en **tu** proyecto de Supabase. Con Row Level Security, cada fila es solo de tu usuario.
- Para tener un respaldo, usa **Ajustes → Exportar** de vez en cuando (CSV de WhatsApp, de Instagram y para la app EDITION).
- En el plan gratis de Supabase, un proyecto que pasa más de una semana sin uso se pausa. Si te pasa, entra a supabase.com y toca **Restore**: tus datos siguen ahí.

---

### Para desarrollo
- La app está en la raíz del repositorio (index.html, app.js, data.js, logic.js…). No necesita compilarse.
- `supabase/schema.sql`: la base de datos.


