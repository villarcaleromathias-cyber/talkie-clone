require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { guardarChatEnDrive } = require('./drive');

const app = express();
app.use(cors());
app.use(express.json());

// Claves API
const XAI_API_KEY = process.env.XAI_API_KEY || "xai-4Tuk9DT2enzppLC10yhdbVeewrZFG0lS1XATWxuczrJpN0S2yUv9X97NTHrnoVe2WFER0lRIuppHw3Ga";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";

// Base de datos local para la prueba
let personajes = [
  { id: '1', nombre: 'Kaedy', descripcion: 'Una chica tímida pero leal.', avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150', personalidad: 'Tímida, dulce, atenta', historia: 'Amiga de la infancia.' },
  { id: '2', nombre: 'Ayase', descripcion: 'Tsundere, fuerte y decidida.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', personalidad: 'Tsundere, ruda por fuera pero tierna por dentro', historia: 'Compañera de clase.' },
  { id: '3', nombre: 'Layla', descripcion: 'Seria, fría y calculadora.', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', personalidad: 'Seria, distante', historia: 'Presidenta del consejo.' },
  { id: '4', nombre: 'Noah', descripcion: 'Amigable, protector y dulce.', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', personalidad: 'Protector y amable', historia: 'Vecino de al lado.' }
];

let chatsHistorial = {};

// 1. GENERACIÓN DE IMAGEN DE PERSONAJE CON OPENAI (DALL-E 3)
app.post('/api/generar-imagen', async (req, res) => {
  const { prompt, estilo } = req.body;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: "dall-e-3",
        prompt: `Character portrait illustration in ${estilo || 'Anime'} style: ${prompt}`,
        n: 1,
        size: "1024x1024"
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ imageUrl: response.data.data[0].url });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Error al generar la imagen con OpenAI' });
  }
});

// 2. OBTENER Y CREAR PERSONAJES
app.get('/api/personajes', (req, res) => res.json(personajes));

app.post('/api/personajes', (req, res) => {
  const nuevoPersonaje = { id: Date.now().toString(), ...req.body };
  personajes.unshift(nuevoPersonaje);
  res.json(nuevoPersonaje);
});

// 3. CHATBOT CON GROK (xAI)
app.post('/api/chat', async (req, res) => {
  const { usuarioId, personajeId, mensaje, personalidad, historia } = req.body;
  const chatId = `${usuarioId}_${personajeId}`;

  if (!chatsHistorial[chatId]) chatsHistorial[chatId] = [];

  chatsHistorial[chatId].push({ role: 'user', content: mensaje });

  const systemPrompt = `Eres el personaje de rol en esta conversación. 
Personalidad: ${personalidad || 'Única'}. 
Trasfondo/Historia: ${historia || 'Sin especificar'}.

INSTRUCCIONES DE FORMATO:
- Todo lo que sean acciones, pensamientos o sucesos físicos DEBES encerrarlos entre asteriscos (*ejemplo: te pega sin decir nada*).
- Todo lo que digas en voz alta como diálogo NO lleva asteriscos.
- Mantén tus respuestas de longitud media (ni demasiado cortas ni demasiado largas).`;

  try {
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatsHistorial[chatId]
        ],
        temperature: 0.85
      },
      {
        headers: {
          'Authorization': `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const respuestaIA = response.data.choices[0].message.content;
    chatsHistorial[chatId].push({ role: 'assistant', content: respuestaIA });

    // Guardar copia en Google Drive
    guardarChatEnDrive(usuarioId || 'Usuario', personajeId, chatsHistorial[chatId]);

    res.json({ respuesta: respuestaIA });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Error al procesar la respuesta con Grok' });
  }
});

// 4. INTERFAZ WEB COMPLETA TIPO TALKIE (Optimizada para Móvil)
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lobby - Talkie Clone</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #050505; color: #fff; display: flex; justify-content: center; }
    .mobile-app { width: 100%; max-width: 450px; height: 100vh; background: #121212; display: flex; flex-direction: column; position: relative; }
    
    header { padding: 18px 20px 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 1.6rem; font-weight: bold; }
    header p { color: #888; font-size: 0.85rem; margin-top: 2px; }

    .content-area { flex: 1; overflow-y: auto; padding: 15px; padding-bottom: 80px; }

    /* Estilo de la Sección de Tarjetas */
    .section-box { background: #1a1a1a; border-radius: 16px; padding: 15px; margin-bottom: 20px; border: 1px solid #282828; }
    .section-title { font-size: 1rem; font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .section-subtitle { font-size: 0.75rem; color: #777; margin-bottom: 12px; }

    .character-item { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; cursor: pointer; }
    .character-item img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 1px solid #333; }
    .character-info h4 { font-size: 0.95rem; font-weight: 600; }
    .character-info p { font-size: 0.8rem; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }

    /* Formulario Crear Personaje */
    .form-group { margin-bottom: 14px; }
    .form-group label { font-size: 0.85rem; color: #ccc; font-weight: 500; display: block; margin-bottom: 5px; }
    input, textarea, select { width: 100%; padding: 12px; background: #222; border: 1px solid #333; color: #fff; border-radius: 10px; font-size: 0.9rem; }
    textarea { height: 70px; resize: none; }
    
    .btn-gold { width: 100%; padding: 14px; background: #e0ab55; border: none; font-weight: bold; color: #000; border-radius: 25px; font-size: 0.95rem; cursor: pointer; margin-top: 10px; }
    
    /* Estilos de Chat y Mensajes (Regla solicitada) */
    .chat-box { display: flex; flex-direction: column; gap: 12px; min-height: 70vh; padding-bottom: 20px; }
    .msg-row { display: flex; flex-direction: column; max-width: 85%; }
    .msg-row.user { align-self: flex-end; }
    .msg-row.bot { align-self: flex-start; }

    /* Estilos solicitados: Acciones plomo/transparente - Habla negro sobre fondo semitransparente */
    .text-action { color: #999999; background: transparent; font-style: italic; display: inline; }
    .text-speech { color: #000000; background: rgba(255, 255, 255, 0.88); padding: 3px 8px; border-radius: 6px; font-weight: 500; display: inline-block; margin: 2px 0; }

    /* Navegación Inferior */
    nav { position: absolute; bottom: 0; left: 0; right: 0; height: 65px; background: #161616; border-top: 1px solid #222; display: flex; justify-content: space-around; align-items: center; }
    .nav-btn { display: flex; flex-direction: column; align-items: center; color: #777; font-size: 0.75rem; cursor: pointer; gap: 4px; }
    .nav-btn.active { color: #e0ab55; font-weight: bold; }
    .btn-add-main { width: 48px; height: 48px; background: #e0ab55; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #000; font-size: 1.5rem; font-weight: bold; margin-top: -20px; border: 3px solid #121212; cursor: pointer; }

    .hidden { display: none !important; }
  </style>
</head>
<body>

<div class="mobile-app">
  <header id="main-header">
    <div>
      <h1 id="header-title">Lobby</h1>
      <p id="header-sub">Tu universo, tus personajes.</p>
    </div>
  </header>

  <div class="content-area">
    
    <!-- VISTA LOBBY -->
    <div id="view-lobby">
      <div class="section-box">
        <div class="section-title">Mis personajes</div>
        <div class="section-subtitle" id="count-personajes">4 personajes</div>
        <div id="list-mis-personajes"></div>
      </div>

      <div class="section-box">
        <div class="section-title">Chats recientes</div>
        <div class="section-subtitle">Conversaciones activas</div>
        <div id="list-chats-recientes"></div>
      </div>
    </div>

    <!-- VISTA CREAR PERSONAJE -->
    <div id="view-crear" class="hidden">
      <div class="form-group">
        <label>Nombre del personaje *</label>
        <input type="text" id="c-nombre" placeholder="Ej: Kaedy">
      </div>
      <div class="form-group">
        <label>Descripción corta *</label>
        <input type="text" id="c-desc" placeholder="Ej: Una chica tímida pero leal.">
      </div>
      <div class="form-group">
        <label>Personalidad *</label>
        <textarea id="c-personalidad" placeholder="Describe cómo se comporta..."></textarea>
      </div>
      <div class="form-group">
        <label>Historia / Trasfondo *</label>
        <textarea id="c-historia" placeholder="Cuenta su pasado o relación contigo..."></textarea>
      </div>
      <div class="form-group">
        <label>Estilo de Imagen IA</label>
        <select id="c-estilo">
          <option value="Anime">Anime</option>
          <option value="Realista">Realista</option>
          <option value="Ilustración">Ilustración</option>
          <option value="3D">3D</option>
        </select>
      </div>
      <button class="btn-gold" onclick="generarImagenIA()">✨ Generar imagen con IA (OpenAI)</button>
      <div id="img-preview" style="text-align:center; margin-top:10px;"></div>
      <button class="btn-gold" style="background:#fff; color:#000; margin-top:15px;" onclick="guardarPersonaje()">Guardar Personaje</button>
    </div>

    <!-- VISTA CHAT -->
    <div id="view-chat" class="hidden">
      <div class="chat-box" id="chat-messages"></div>
      <div style="display:flex; gap:8px; position: fixed; bottom: 15px; max-width: 420px; width: 90%;">
        <input type="text" id="chat-input" placeholder="Escribe un mensaje..." style="margin:0;">
        <button onclick="enviarMensaje()" style="width:70px; background:#e0ab55; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">Enviar</button>
      </div>
    </div>

  </div>

  <nav id="bottom-nav">
    <div class="nav-btn active" id="nav-lobby-btn" onclick="showTab('lobby')">
      <span>👤</span>
      <span>Personajes</span>
    </div>
    <div class="btn-add-main" onclick="showTab('crear')">+</div>
    <div class="nav-btn" id="nav-chats-btn" onclick="showTab('lobby')">
      <span>💬</span>
      <span>Chats</span>
    </div>
  </nav>
</div>

<script>
  let personajeActual = null;
  let avatarGenerado = '';

  function showTab(tab) {
    document.getElementById('view-lobby').classList.add('hidden');
    document.getElementById('view-crear').classList.add('hidden');
    document.getElementById('view-chat').classList.add('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');

    if (tab === 'lobby') {
      document.getElementById('view-lobby').classList.remove('hidden');
      document.getElementById('header-title').innerText = 'Lobby';
      document.getElementById('header-sub').innerText = 'Tu universo, tus personajes.';
      cargarLobby();
    } else if (tab === 'crear') {
      document.getElementById('view-crear').classList.remove('hidden');
      document.getElementById('header-title').innerText = 'Crear personaje';
      document.getElementById('header-sub').innerText = 'Diseña un nuevo acompañante con IA';
    } else if (tab === 'chat') {
      document.getElementById('view-chat').classList.remove('hidden');
      document.getElementById('bottom-nav').classList.add('hidden');
    }
  }

  async function cargarLobby() {
    const res = await fetch('/api/personajes');
    const data = await res.json();
    
    document.getElementById('count-personajes').innerText = data.length + ' personajes';
    
    const contMis = document.getElementById('list-mis-personajes');
    const contChats = document.getElementById('list-chats-recientes');
    contMis.innerHTML = '';
    contChats.innerHTML = '';

    data.forEach(p => {
      const itemHTML = \`
        <div class="character-item" onclick="iniciarChat('\${p.id}', '\${p.nombre}', '\${p.personalidad || ''}', '\${p.historia || ''}')">
          <img src="\${p.avatar}" />
          <div class="character-info">
            <h4>\${p.nombre}</h4>
            <p>\${p.descripcion}</p>
          </div>
        </div>
      \`;
      contMis.innerHTML += itemHTML;
      contChats.innerHTML += itemHTML;
    });
  }

  async function generarImagenIA() {
    const prompt = document.getElementById('c-desc').value;
    const estilo = document.getElementById('c-estilo').value;
    const preview = document.getElementById('img-preview');
    if(!prompt) return alert('Por favor escribe primero una descripción corta.');

    preview.innerText = 'Generando imagen con OpenAI...';
    const res = await fetch('/api/generar-imagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, estilo })
    });
    const data = await res.json();
    if(data.imageUrl) {
      avatarGenerado = data.imageUrl;
      preview.innerHTML = \`<img src="\${data.imageUrl}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-top:8px;" />\`;
    } else {
      preview.innerText = 'Error al generar imagen.';
    }
  }

  async function guardarPersonaje() {
    const nombre = document.getElementById('c-nombre').value;
    const descripcion = document.getElementById('c-desc').value;
    const personalidad = document.getElementById('c-personalidad').value;
    const historia = document.getElementById('c-historia').value;

    if(!nombre || !descripcion) return alert('Completa los campos obligatorios');

    await fetch('/api/personajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        descripcion,
        personalidad,
        historia,
        avatar: avatarGenerado || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'
      })
    });

    showTab('lobby');
  }

  function iniciarChat(id, nombre, personalidad, historia) {
    personajeActual = { id, nombre, personalidad, historia };
    document.getElementById('header-title').innerText = nombre;
    document.getElementById('header-sub').innerText = 'En línea';
    document.getElementById('chat-messages').innerHTML = '';
    showTab('chat');
  }

  // Formateador: Convierte *acciones* a plomo/transparente y habla a negro sobre fondo semitransparente
  function formatText(texto) {
    const partes = texto.split(/(\*[^*]+\*)/g);
    return partes.map(p => {
      if(p.startsWith('*') && p.endsWith('*')) {
        return \`<span class="text-action">\${p}</span>\`;
      } else if(p.trim() !== '') {
        return \`<span class="text-speech">\${p}</span>\`;
      }
      return '';
    }).join(' ');
  }

  async function enviarMensaje() {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if(!msg || !personajeActual) return;

    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += \`<div class="msg-row user"><div style="text-align:right;">\${formatText(msg)}</div></div>\`;
    input.value = '';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: 'user_phone',
        personajeId: personajeActual.id,
        mensaje: msg,
        personalidad: personajeActual.personalidad,
        historia: personajeActual.historia
      })
    });

    const data = await res.json();
    chatBox.innerHTML += \`<div class="msg-row bot"><div>\${formatText(data.respuesta)}</div></div>\`;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  cargarLobby();
</script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
