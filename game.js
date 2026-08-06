/* ==========================================================================
   STOP DIGITAL PRO - Game Logic & PeerJS Architecture (FIXED MULTIPLAYER)
   ========================================================================== */

// --- GLOBAL GAME STATE ---
const DEFAULT_CATEGORIES = [
  "Nombre", 
  "Apellido", 
  "Ciudad/País", 
  "Fruta", 
  "Animal", 
  "Color", 
  "Cosa/Objeto"
];

const CATEGORY_PRESETS = {
  classic: [...DEFAULT_CATEGORIES],
  pop: ["Película/Serie", "Personaje Famoso", "Canción/Artista", "Marca/Empresa", "Comida/Bebida", "Superhéroe"],
  geo: ["País/Capital", "Río/Montaña", "Animal", "Planta/Flor", "Mineral/Elemento", "Profesión"],
  gamer: ["Videojuego", "Personaje Anime/Juego", "Consola/Tech", "Poder/Habilidad", "Lugar Fantástico"]
};

let peer = null;
let connections = [];
let hostConn = null;
let isHost = false;
let isSoloMode = false;
let soloBotLevel = 'normal';
let currentBotAnswers = {};
let myName = "";
let myPeerId = "";
let currentLetter = "";
let currentRound = 0;
let roundTimerInterval = null;
let heartbeatInterval = null; // Heartbeat para evitar desconexiones
let timerTotalSeconds = 0;
let timerSecondsLeft = 0;
let isAudioEnabled = true;
let isRoundActive = false;
let currentRoomCode = "";

let config = {
  timer: 60,
  maxRounds: 5,
  categories: [...DEFAULT_CATEGORIES]
};

let players = {}; 

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Configuración ICE mejorada con STUNs redundantes
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

// --- INITIALIZATION & PWA SERVICE WORKER ---
window.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initThemeAndPrefs();
  initSplash();
  setupNetworkListeners();
  setupVisibilityListener();
});

function setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!isSoloMode && currentRoomCode) {
        if (!isHost) {
          if (!hostConn || !hostConn.open) {
            console.log('[Visibility] Pantalla activa, reconectando...');
            attemptClientReconnect(currentRoomCode);
          } else {
            console.log('[Visibility] Pantalla activa, solicitando estado al Host...');
            try {
              hostConn.send({ type: 'RECONNECT_REQUEST', name: myName, peerId: myPeerId });
            } catch (e) {
              attemptClientReconnect(currentRoomCode);
            }
          }
        }
      }
    }
  });
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado con éxito:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Error al registrar Service Worker:', err);
      });
  }
}

function setupNetworkListeners() {
  const offlineBanner = document.getElementById('offline-banner');
  
  function updateOnlineStatus() {
    if (navigator.onLine) {
      if (offlineBanner) offlineBanner.classList.remove('visible');
      showToast('📶 Conexión restablecida', false);
    } else {
      if (offlineBanner) offlineBanner.classList.add('visible');
      showToast('⚠️ Sin conexión a Internet', true);
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if (!navigator.onLine && offlineBanner) {
    offlineBanner.classList.add('visible');
  }
}

function initThemeAndPrefs() {
  const savedName = localStorage.getItem('stop_username');
  if (savedName) {
    const nameInput = document.getElementById('username');
    if (nameInput) nameInput.value = savedName;
  }

  const savedTheme = localStorage.getItem('stop_theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('stop_theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = isLight ? '🌙' : '☀️';
  }
}

function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  const btn = document.getElementById('audio-toggle-btn');
  if (btn) {
    btn.innerHTML = isAudioEnabled ? '🔊' : '🔇';
  }
  showToast(isAudioEnabled ? 'Sonido activado' : 'Sonido silenciado', false);
}

// --- SPLASH SCREEN VERIFICATION ---
function initSplash() {
  const statusEl = document.getElementById('splash-status');
  const splashEl = document.getElementById('splash-screen');

  if (statusEl) statusEl.innerText = 'Verificando red y sistema...';

  setTimeout(() => {
    if (!navigator.onLine) {
      if (statusEl) {
        statusEl.innerText = '⚠️ Modo sin conexión activo';
        statusEl.style.color = 'var(--md-sys-color-warning)';
      }
    } else {
      if (statusEl) statusEl.innerText = '✅ Sistema listo';
    }

    setTimeout(() => {
      if (splashEl) {
        splashEl.style.opacity = '0';
        setTimeout(() => {
          splashEl.style.display = 'none';
        }, 500);
      }
    }, 600);
  }, 1000);
}

// --- TOASTS & MODALS ---
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.innerHTML = isError ? `⚠️ <span>${message}</span>` : `✨ <span>${message}</span>`;
  toast.style.borderColor = isError ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-success)';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function showModal(title, bodyText) {
  const overlay = document.getElementById('modal-overlay');
  const tEl = document.getElementById('modal-title');
  const bEl = document.getElementById('modal-body');

  if (tEl) tEl.innerText = title;
  if (bEl) bEl.innerText = bodyText;
  if (overlay) overlay.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// --- VIEW NAVIGATION & LEAVE ROOM ---
function showView(viewId) {
  const current = document.querySelector('.view.active');
  const target = document.getElementById(viewId);

  if (!target || (current && current.id === viewId)) return;

  if (current) {
    current.classList.remove('active');
    current.classList.add('exit');
    setTimeout(() => current.classList.remove('exit'), 400);
  }

  target.classList.add('active');

  const reactionBar = document.getElementById('floating-reaction-bar');
  if (reactionBar) {
    if (['view-lobby', 'view-game', 'view-results'].includes(viewId)) {
      reactionBar.classList.remove('hidden');
    } else {
      reactionBar.classList.add('hidden');
    }
  }
}

function confirmLeaveRoom() {
  const activeView = document.querySelector('.view.active');
  const isPlaying = activeView && activeView.id === 'view-game';

  if (!isPlaying) {
    leaveRoom();
    return;
  }

  const overlay = document.getElementById('confirm-modal-overlay');
  const actionBtn = document.getElementById('confirm-modal-action-btn');
  if (overlay && actionBtn) {
    actionBtn.onclick = () => {
      closeConfirmModal();
      leaveRoom();
    };
    overlay.classList.add('active');
  } else {
    leaveRoom();
  }
}

function closeConfirmModal() {
  const overlay = document.getElementById('confirm-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function leaveRoom() {
  clearInterval(roundTimerInterval);
  stopHeartbeat();
  closeModal();
  closeConfirmModal();

  if (isHost && !isSoloMode) {
    broadcast({ type: 'HOST_LEFT' });
    connections.forEach(c => {
      try { c.close(); } catch (e) {}
    });
    connections = [];
  } else if (hostConn) {
    try {
      hostConn.send({ type: 'CLIENT_LEFT', peerId: myPeerId, name: myName });
      hostConn.close();
    } catch (e) {}
    hostConn = null;
  }

  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }

  players = {};
  currentRound = 0;
  isHost = false;
  isSoloMode = false;
  currentBotAnswers = {};

  const btnCreate = document.getElementById('btn-create');
  if (btnCreate) {
    btnCreate.disabled = false;
    btnCreate.innerHTML = '<span>🚀</span> Crear Sala Multijugador';
  }

  const btnJoin = document.getElementById('btn-join');
  if (btnJoin) {
    btnJoin.disabled = false;
    btnJoin.innerHTML = '<span>🔑</span> Unirse a Sala';
  }

  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) startBtn.style.display = 'flex';

  const hostOpts = document.getElementById('host-options');
  if (hostOpts) hostOpts.classList.add('hidden');

  showView('view-setup');
  showToast('Has salido al menú principal', false);
}

// --- MODO SOLITARIO VS IA GEMINI ---
function startSoloMode() {
  const nameInput = document.getElementById('username');
  myName = nameInput ? nameInput.value.trim() : "";
  if (!myName) myName = "Jugador";

  const botLevelSelect = document.getElementById('solo-bot-level');
  soloBotLevel = botLevelSelect ? botLevelSelect.value : "normal";

  isSoloMode = true;
  isHost = true;
  myPeerId = 'HOST';

  players = {
    "HOST": { name: myName, total: 0, answers: {}, roundPts: {}, invalidMap: {} },
    "BOT_AI": { name: `🤖 Bot Gemini (${soloBotLevel.toUpperCase()})`, total: 0, answers: {}, roundPts: {}, invalidMap: {} }
  };

  currentRound = 0;
  showToast(`¡Modo Solitario iniciado contra Bot Gemini (${soloBotLevel.toUpperCase()})!`, false);
  hostLaunchRound();
}

// --- SOUND SYNTHESIZER EFFECTS ---
function playSound(type) {
  if (!isAudioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'stop') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'fanfare') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3);
        o.start(ctx.currentTime + idx * 0.12);
        o.stop(ctx.currentTime + idx * 0.12 + 0.3);
      });
    }
  } catch (e) {
    console.log('Audio Context error:', e);
  }
}

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 150]);
  }
}

// --- SYSTEM HEARTBEAT (Mantiene vivas las conexiones y tolera cambio de pestañas) ---
function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (isHost) {
      broadcast({ type: 'PING' });
      const now = Date.now();
      Object.keys(players).forEach(peerId => {
        // Tolerancia de 25 segundos antes de declarar desconectado por si el jugador cambió de pestaña temporalmente
        if (peerId !== 'HOST' && players[peerId].lastPing && (now - players[peerId].lastPing > 25000)) {
          console.log(`Jugador ${players[peerId].name} inactivo o desconectado.`);
          showToast(`${players[peerId].name} se desconectó`, true);
          delete players[peerId];
          updateLobbyUI();
        }
      });
    } else if (hostConn && hostConn.open) {
      hostConn.send({ type: 'PING' });
    }
  }, 3000); // Enviar pulso cada 3 segundos
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// --- PEERJS MULTIPLAYER & AUTO-RECONNECT ---
function formatRoomInput(input) {
  if (!input) return;
  let val = input.value.toUpperCase();
  val = val.replace(/^STOP-?/, '');
  input.value = val;
}

function goToLobby(hostRole) {
  const usernameInput = document.getElementById('username');
  myName = usernameInput ? usernameInput.value.trim() : "";

  if (!myName) {
    showToast('Por favor escribe tu apodo', true);
    return;
  }

  localStorage.setItem('stop_username', myName);
  isHost = hostRole;

  const btn = isHost ? document.getElementById('btn-create') : document.getElementById('btn-join');
  const originalHtml = btn.innerHTML;

  btn.innerHTML = `<span class="spinner"></span> Conectando...`;
  btn.disabled = true;

  if (isHost) {
    const randomCode = "STOP-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    setupPeerHost(randomCode, btn, originalHtml);
  } else {
    const roomInput = document.getElementById('room-input');
    let rawCode = roomInput ? roomInput.value.trim().toUpperCase() : "";
    rawCode = rawCode.replace(/^STOP-?/, '');

    if (!rawCode) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast('Ingresa el código de la sala (Ej: A1B2)', true);
      return;
    }

    const roomCode = "STOP-" + rawCode;
    setupPeerClient(roomCode, btn, originalHtml);
  }
}

function setupPeerHost(roomCode, btn, originalHtml) {
  peer = new Peer(roomCode, {
    debug: 1,
    config: ICE_SERVERS
  });

  peer.on('open', (id) => {
    myPeerId = id;
    currentRoomCode = id;
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }

    const codeDisplay = document.getElementById('room-id-display');
    if (codeDisplay) codeDisplay.innerText = id;

    const hostOpts = document.getElementById('host-options');
    if (hostOpts) hostOpts.classList.remove('hidden');

    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) startBtn.style.display = 'flex';

    players = {};
    players["HOST"] = { name: myName, total: 0, answers: {}, roundPts: {}, overrideMap: {} };

    updateLobbyUI();
    showView('view-lobby');
    startHeartbeat();
    showToast(`Sala ${id} creada con éxito`, false);
  });

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      // Evitar conexiones duplicadas del mismo peer
      connections = connections.filter(c => c.peer !== conn.peer);
      connections.push(conn);
    });

    conn.on('data', (data) => {
      handleIncomingData(data, conn);
    });

    conn.on('close', () => {
      connections = connections.filter(c => c.peer !== conn.peer);
      if (players[conn.peer]) {
        showToast(`${players[conn.peer].name} se desconectó`, true);
        delete players[conn.peer];
        updateLobbyUI();
      }
    });

    conn.on('error', (err) => {
      console.warn('Error en conexión de peer:', err);
    });
  });

  setupAutoReconnect(peer);

  peer.on('error', (err) => {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
    let errorMsg = 'Error en la red P2P';
    if (err.type === 'unavailable-id') {
      const newCode = "STOP-" + Math.random().toString(36).substring(2, 6).toUpperCase();
      setTimeout(() => setupPeerHost(newCode, btn, originalHtml), 1000);
      return;
    }
    showToast(errorMsg, true);
  });
}

function setupPeerClient(roomCode, btn, originalHtml) {
  peer = new Peer({
    debug: 1,
    config: ICE_SERVERS
  });

  peer.on('open', (id) => {
    myPeerId = id;
    connectToHost(roomCode, btn, originalHtml);
  });

  setupAutoReconnect(peer);

  peer.on('error', (err) => {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }

    let msg = 'No se pudo conectar al servidor P2P';
    if (err.type === 'peer-unavailable') {
      msg = `No existe la sala "${roomCode}". Verifica el código.`;
    }

    showToast(msg, true);
  });
}

function connectToHost(roomCode, btn, originalHtml) {
  currentRoomCode = roomCode;
  hostConn = peer.connect(roomCode, { reliable: true });

  let connectTimeout = setTimeout(() => {
    if (hostConn && !hostConn.open) {
      if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
      showToast(`Tiempo de espera agotado al conectar a "${roomCode}"`, true);
      try { hostConn.close(); } catch (e) {}
    }
  }, 12000);

  hostConn.on('open', () => {
    clearTimeout(connectTimeout);
    reconnectAttempts = 0;
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }

    hostConn.send({ type: 'JOIN', name: myName, peerId: myPeerId });

    const codeDisplay = document.getElementById('room-id-display');
    if (codeDisplay) codeDisplay.innerText = roomCode;

    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) startBtn.style.display = 'none';

    const activeView = document.querySelector('.view.active');
    if (!activeView || (activeView.id !== 'view-game' && activeView.id !== 'view-results')) {
      showView('view-lobby');
    }

    startHeartbeat();
    showToast('¡Unido a la sala con éxito!', false);
  });

  hostConn.on('data', (data) => {
    handleIncomingData(data, hostConn);
  });

  hostConn.on('close', () => {
    clearTimeout(connectTimeout);
    console.log('Se interrumpió la conexión con el Host. Intentando reconectar...');
    attemptClientReconnect(roomCode);
  });

  hostConn.on('error', (err) => {
    clearTimeout(connectTimeout);
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });
}

function setupAutoReconnect(peerInstance) {
  peerInstance.on('disconnected', () => {
    console.log('Servidor P2P desconectado. Reenganchando...');
    peerInstance.reconnect();
  });
}

function attemptClientReconnect(roomCode) {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    showToast(`Reconectando (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, false);
    setTimeout(() => {
      if (peer && !peer.destroyed) {
        connectToHost(roomCode, null, null);
      }
    }, 1500 * reconnectAttempts);
  } else {
    showToast('No se pudo recuperar la conexión con la sala', true);
    leaveRoom();
  }
}

// --- DATA MESSAGE HANDLING ---
function handleIncomingData(data, conn) {
  if (isHost && conn && conn.peer && players[conn.peer]) {
    players[conn.peer].lastPing = Date.now();
  }

  if (data.type === 'PING') {
    if (conn && conn.open) conn.send({ type: 'PONG' });
    return;
  }
  if (data.type === 'PONG') {
    return; // PONG recibido, conexión viva
  }

  if (data.type === 'REACTION') {
    showFloatingReaction(data.emoji, data.sender);
    if (isHost) {
      broadcast(data); // El Host retransmite la reacción a los demás jugadores
    }
    return;
  }

  if (isHost) {
    if (data.type === 'JOIN' || data.type === 'RECONNECT_REQUEST') {
      const pId = data.peerId || conn.peer;
      if (!players[pId]) {
        players[pId] = { name: data.name, total: 0, answers: {}, roundPts: {}, overrideMap: {} };
      }
      players[pId].lastPing = Date.now();
      updateLobbyUI();
      broadcast({ type: 'SETTINGS_UPDATE', config });
      showToast(`${data.name} ${data.type === 'RECONNECT_REQUEST' ? 'reconectó' : 'se unió'}`, false);

      if (isRoundActive) {
        conn.send({
          type: 'CURRENT_ROUND_SYNC',
          round: currentRound,
          letter: currentLetter,
          config: config,
          timerSecondsLeft: timerSecondsLeft,
          timerTotalSeconds: timerTotalSeconds
        });
      } else if (currentRound > 0 && players["HOST"] && players["HOST"].answers) {
        conn.send({
          type: 'RESULTS',
          players: players
        });
      }
    }
    if (data.type === 'CLIENT_LEFT') {
      delete players[data.peerId || conn.peer];
      updateLobbyUI();
      showToast(`${data.name || 'Un jugador'} salió de la sala`, true);
    }
    if (data.type === 'STOP_CALLED') {
      stopRoundEveryone();
    }
    if (data.type === 'SUBMIT') {
      if (players[conn.peer]) {
        players[conn.peer].answers = data.answers;
      }
      checkAllAnswersSubmitted();
    }
  } else {
    if (data.type === 'HOST_LEFT') {
      showToast('El Host ha cerrado la sala', true);
      leaveRoom();
    }
    if (data.type === 'SETTINGS_UPDATE') {
      config = data.config;
    }
    if (data.type === 'SYNC_LOBBY') {
      const activeView = document.querySelector('.view.active');
      if (!activeView || activeView.id === 'view-lobby') {
        const countEl = document.getElementById('players-count');
        if (countEl) countEl.innerText = `Jugadores conectados: ${data.count}`;
        if (data.players) renderPlayerListClient(data.players);
      }
    }
    if (data.type === 'START_GAME') {
      currentLetter = data.letter;
      config = data.config;
      currentRound = data.round;
      startRoundUI();
    }
    if (data.type === 'CURRENT_ROUND_SYNC') {
      currentLetter = data.letter;
      config = data.config;
      currentRound = data.round;
      timerSecondsLeft = data.timerSecondsLeft;
      timerTotalSeconds = data.timerTotalSeconds;
      restoreActiveRoundUI();
    }
    if (data.type === 'FORCE_STOP') {
      playSound('stop');
      triggerHaptic();
      lockAndSubmitAnswers();
    }
    if (data.type === 'RESULTS') {
      players = data.players;
      renderResultsUI();
    }
    if (data.type === 'AI_VALIDATION_RESULTS') {
      renderAiDictionaryUI(data.aiResults);
    }
    if (data.type === 'FINAL_VICTORY') {
      showPodiumUI(data.winner);
    }
  }
}

// --- COPY ROOM CODE ---
function copyRoomCode() {
  const codeEl = document.getElementById('room-id-display');
  if (!codeEl) return;
  const code = codeEl.innerText;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => {
      showToast('¡Código copiado al portapapeles!', false);
    });
  } else {
    showToast(`Código de sala: ${code}`, false);
  }
}

// --- LOBBY MANAGEMENT ---
function updateLobbyUI() {
  const count = Object.keys(players).length;
  const countEl = document.getElementById('players-count');
  if (countEl) countEl.innerHTML = `✅ <strong>${count}</strong> Jugador(es) en sala`;

  renderPlayerListHost();

  broadcast({
    type: 'SYNC_LOBBY',
    count: count,
    players: players
  });
}

function renderPlayerListHost() {
  const listEl = document.getElementById('player-list-container');
  if (!listEl) return;

  let html = '';
  Object.entries(players).forEach(([id, p]) => {
    const isRoomHost = id === 'HOST';
    html += `
      <div class="player-item">
        <div class="player-info">
          <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div class="player-name">${p.name}</div>
        </div>
        ${isRoomHost ? '<span class="host-badge">HOST</span>' : '<span class="pts-badge">+0 pts</span>'}
      </div>
    `;
  });

  listEl.innerHTML = html;
}

function renderPlayerListClient(pData) {
  const listEl = document.getElementById('player-list-container');
  if (!listEl || !pData) return;

  let html = '';
  Object.entries(pData).forEach(([id, p]) => {
    const isRoomHost = id === 'HOST';
    html += `
      <div class="player-item">
        <div class="player-info">
          <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div class="player-name">${p.name}</div>
        </div>
        ${isRoomHost ? '<span class="host-badge">HOST</span>' : ''}
      </div>
    `;
  });

  listEl.innerHTML = html;
}

let botAiFetchPromise = null;

// --- GAMEPLAY ROUND LAUNCH & TIMER ---
function hostLaunchRound() {
  isRoundActive = true;
  currentRound++;

  const timerSelect = document.getElementById('timer-select');
  const roundsSelect = document.getElementById('rounds-select');

  config.timer = timerSelect ? parseInt(timerSelect.value) : 60;
  config.maxRounds = roundsSelect ? parseInt(roundsSelect.value) : 5;

  const alphabet = "ABCDEFGHJKLMNOPRSTUVW";
  currentLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

  Object.keys(players).forEach(id => {
    players[id].answers = {};
    players[id].roundPts = {};
    players[id].overrideMap = {};
  });

  currentBotAnswers = {};
  botAiFetchPromise = null;

  if (isSoloMode) {
    // Generar respuestas del Bot IA en segundo plano durante la ronda
    botAiFetchPromise = fetch('/api/generate-ai-bot-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        letter: currentLetter,
        categories: config.categories,
        botLevel: soloBotLevel
      })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.answers) {
        currentBotAnswers = data.answers;
      }
    })
    .catch(err => console.error('Error generando bot AI:', err));
  }

  broadcast({
    type: 'START_GAME',
    letter: currentLetter,
    config: config,
    round: currentRound
  });

  startRoundUI();
}

// --- COUNTDOWN OVERLAY ANIMATION ---
let countdownTimeout = null;

function runRoundCountdown(letter, onComplete) {
  if (countdownTimeout) clearTimeout(countdownTimeout);

  const overlay = document.getElementById('countdown-overlay');
  const badge = document.getElementById('countdown-letter-badge');
  const numEl = document.getElementById('countdown-number');
  const subtitleEl = document.getElementById('countdown-subtitle');

  if (!overlay || !numEl) {
    if (onComplete) onComplete();
    return;
  }

  if (badge) badge.innerText = `LETRA: ${letter}`;
  overlay.classList.remove('hidden');

  const steps = [
    { num: '3', sub: '¡PREPÁRATE!', sound: 'beep', go: false },
    { num: '2', sub: 'LISTOS...', sound: 'beep', go: false },
    { num: '1', sub: '¡ATENTOS!', sound: 'beep', go: false },
    { num: '¡A JUGAR!', sub: '¡COMPLETA LAS PALABRAS!', sound: 'stop', go: true }
  ];

  let currentStep = 0;

  function showStep() {
    if (currentStep >= steps.length) {
      overlay.classList.add('hidden');
      if (onComplete) onComplete();
      return;
    }

    const step = steps[currentStep];
    numEl.innerText = step.num;
    if (subtitleEl) subtitleEl.innerText = step.sub;

    if (step.go) {
      numEl.classList.add('go');
    } else {
      numEl.classList.remove('go');
    }

    // Force animation reflow for punchy scale pop
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = null;

    playSound(step.sound);
    triggerHaptic();

    currentStep++;
    countdownTimeout = setTimeout(showStep, step.go ? 850 : 750);
  }

  showStep();
}

function saveDraftAnswers() {
  const inputs = document.querySelectorAll('.game-input');
  let drafts = {};
  inputs.forEach(input => {
    if (input.dataset.cat) {
      drafts[input.dataset.cat] = input.value;
    }
  });
  try {
    sessionStorage.setItem(`stop_draft_${currentRound}_${currentLetter}`, JSON.stringify(drafts));
  } catch(e) {}
}

function restoreDraftAnswers() {
  try {
    const saved = sessionStorage.getItem(`stop_draft_${currentRound}_${currentLetter}`);
    if (saved) {
      const drafts = JSON.parse(saved);
      const inputs = document.querySelectorAll('.game-input');
      inputs.forEach(input => {
        const cat = input.dataset.cat;
        if (cat && drafts[cat] !== undefined) {
          input.value = drafts[cat];
        }
      });
    }
  } catch(e) {}
}

function restoreActiveRoundUI() {
  const container = document.getElementById('cats-inputs-container');
  if (!container) return;

  const activeView = document.querySelector('.view.active');
  const isAlreadyInGameView = activeView && activeView.id === 'view-game';

  if (!isAlreadyInGameView) {
    container.innerHTML = "";
    config.categories.forEach((cat) => {
      container.innerHTML += `
        <div class="category-card">
          <label class="input-label">${cat}</label>
          <input type="text" class="input-field game-input" data-cat="${cat}" placeholder="Palabra con ${currentLetter}..." autocomplete="off" spellcheck="false" oninput="saveDraftAnswers()">
        </div>
      `;
    });

    const letterDisplay = document.getElementById('current-letter');
    if (letterDisplay) letterDisplay.innerText = currentLetter;

    const roundNumDisplay = document.getElementById('game-round-tag');
    if (roundNumDisplay) roundNumDisplay.innerText = `Ronda ${currentRound} de ${config.maxRounds}`;

    showView('view-game');
  }

  const inputs = document.querySelectorAll('.game-input');
  inputs.forEach(i => {
    i.disabled = false;
    i.removeEventListener('input', saveDraftAnswers);
    i.addEventListener('input', saveDraftAnswers);
  });

  restoreDraftAnswers();
  updateTimerUI();
  closeModal();

  clearInterval(roundTimerInterval);
  if (timerTotalSeconds > 0 && timerSecondsLeft > 0) {
    roundTimerInterval = setInterval(() => {
      timerSecondsLeft--;
      updateTimerUI();

      if (timerSecondsLeft <= 5 && timerSecondsLeft > 0) {
        playSound('beep');
      }

      if (timerSecondsLeft <= 0) {
        clearInterval(roundTimerInterval);
        triggerStop();
      }
    }, 1000);
  }

  showToast(`⚡ Reconectado a la Ronda ${currentRound} (Letra ${currentLetter})`, false);
}

function startRoundUI() {
  const container = document.getElementById('cats-inputs-container');
  if (!container) return;

  container.innerHTML = "";

  config.categories.forEach((cat) => {
    container.innerHTML += `
      <div class="category-card">
        <label class="input-label">${cat}</label>
        <input type="text" class="input-field game-input" data-cat="${cat}" placeholder="Palabra con ${currentLetter}..." autocomplete="off" spellcheck="false" disabled oninput="saveDraftAnswers()">
      </div>
    `;
  });

  const letterDisplay = document.getElementById('current-letter');
  if (letterDisplay) letterDisplay.innerText = currentLetter;

  const roundNumDisplay = document.getElementById('game-round-tag');
  if (roundNumDisplay) roundNumDisplay.innerText = `Ronda ${currentRound} de ${config.maxRounds}`;

  timerTotalSeconds = config.timer;
  timerSecondsLeft = config.timer;
  updateTimerUI();

  showView('view-game');
  closeModal();

  // Iniciar la animación de conteo antes de activar la partida
  runRoundCountdown(currentLetter, () => {
    // Habilitar inputs al terminar el conteo
    const inputs = document.querySelectorAll('.game-input');
    inputs.forEach(i => {
      i.disabled = false;
      i.removeEventListener('input', saveDraftAnswers);
      i.addEventListener('input', saveDraftAnswers);
    });

    restoreDraftAnswers();

    const firstInput = document.querySelector('.game-input');
    if (firstInput) firstInput.focus();

    // Iniciar el temporizador oficial de la ronda
    clearInterval(roundTimerInterval);
    if (timerTotalSeconds > 0) {
      roundTimerInterval = setInterval(() => {
        timerSecondsLeft--;
        updateTimerUI();

        if (timerSecondsLeft <= 5 && timerSecondsLeft > 0) {
          playSound('beep');
        }

        if (timerSecondsLeft <= 0) {
          clearInterval(roundTimerInterval);
          triggerStop();
        }
      }, 1000);
    }
  });
}

function updateTimerUI() {
  const timerVal = document.getElementById('game-timer-val');
  const timerBar = document.getElementById('timer-bar-fill');

  if (timerTotalSeconds === 0) {
    if (timerVal) timerVal.innerText = "⏳ SIN LÍMITE";
    if (timerBar) timerBar.style.width = "100%";
    return;
  }

  if (timerVal) timerVal.innerText = `${timerSecondsLeft}s`;

  if (timerBar) {
    const pct = Math.max(0, Math.min(100, (timerSecondsLeft / timerTotalSeconds) * 100));
    timerBar.style.width = `${pct}%`;

    timerBar.classList.remove('warning', 'critical');
    if (pct <= 20) {
      timerBar.classList.add('critical');
    } else if (pct <= 45) {
      timerBar.classList.add('warning');
    }
  }
}

function triggerStop() {
  isRoundActive = false;
  clearInterval(roundTimerInterval);
  playSound('stop');
  triggerHaptic();

  if (isHost) {
    stopRoundEveryone();
  } else {
    if (hostConn && hostConn.open) {
      hostConn.send({ type: 'STOP_CALLED' });
    }
  }
}

function stopRoundEveryone() {
  isRoundActive = false;
  broadcast({ type: 'FORCE_STOP' });
  lockAndSubmitAnswers();
}

async function lockAndSubmitAnswers() {
  const inputs = document.querySelectorAll('.game-input');
  let myAnswers = {};

  inputs.forEach((input) => {
    input.disabled = true;
    const cat = input.dataset.cat;
    myAnswers[cat] = input.value.trim().toUpperCase();
  });

  showModal('🛑 ¡STOP!', 'Sincronizando y procesando respuestas...');

  if (isHost) {
    players["HOST"].answers = myAnswers;
    if (isSoloMode) {
      if (botAiFetchPromise) {
        await Promise.race([
          botAiFetchPromise,
          new Promise(r => setTimeout(r, 2500))
        ]);
      }
      players["BOT_AI"].answers = {};
      config.categories.forEach(cat => {
        let rawVal = (currentBotAnswers && currentBotAnswers[cat]) ? currentBotAnswers[cat] : "-";
        players["BOT_AI"].answers[cat] = String(rawVal).trim().toUpperCase();
      });
    }
    checkAllAnswersSubmitted();
  } else {
    if (hostConn && hostConn.open) {
      hostConn.send({ type: 'SUBMIT', answers: myAnswers });
    }
  }
}

function checkAllAnswersSubmitted() {
  const total = Object.keys(players).length;
  const submitted = Object.values(players).filter(p => p.answers && Object.keys(p.answers).length > 0).length;

  if (submitted >= total) {
    calculateRoundPoints();
    broadcast({ type: 'RESULTS', players: players });
    renderResultsUI();
  }
}

// --- POINTS CALCULATION & HOST MODERATION ---
function calculateRoundPoints() {
  const ids = Object.keys(players);

  config.categories.forEach((cat) => {
    let wordCounts = {};

    ids.forEach((id) => {
      let rawAns = (players[id].answers && players[id].answers[cat]) ? players[id].answers[cat].trim().toUpperCase() : "";
      if (rawAns && rawAns.startsWith(currentLetter.toUpperCase())) {
        wordCounts[rawAns] = (wordCounts[rawAns] || 0) + 1;
      }
    });

    ids.forEach((id) => {
      let ans = (players[id].answers && players[id].answers[cat]) ? players[id].answers[cat].trim().toUpperCase() : "";
      let override = players[id].overrideMap ? players[id].overrideMap[cat] : undefined;

      let pts = 0;
      if (override === 'invalid') {
        pts = 0;
      } else if (override === 'half') {
        pts = 50;
      } else if (override === 'full') {
        pts = 100;
      } else if (override === 'valid') {
        if (ans && ans.length > 0) {
          pts = wordCounts[ans] > 1 ? 50 : 100;
        } else {
          pts = 0;
        }
      } else {
        if (ans && ans.startsWith(currentLetter.toUpperCase())) {
          pts = wordCounts[ans] > 1 ? 50 : 100;
        } else {
          pts = 0;
        }
      }

      players[id].roundPts = players[id].roundPts || {};
      players[id].roundPts[cat] = pts;
    });
  });

  ids.forEach((id) => {
    const roundSum = Object.values(players[id].roundPts).reduce((acc, val) => acc + val, 0);
    players[id].total = roundSum + (players[id].previousTotal || 0);
  });
}

function renderResultsUI() {
  closeModal();
  showView('view-results');

  const roundNumEl = document.getElementById('results-round-num');
  if (roundNumEl) roundNumEl.innerText = currentRound;

  const hintEl = document.getElementById('host-moderation-hint');
  const nextBtn = document.getElementById('next-round-btn');

  if (isHost) {
    if (hintEl) hintEl.style.display = 'block';
    if (nextBtn) {
      nextBtn.classList.remove('hidden');
      if (currentRound >= config.maxRounds) {
        nextBtn.innerText = "🏆 Ver Resultados Finales";
        nextBtn.onclick = checkFinalWinner;
      } else {
        nextBtn.innerText = "Siguiente Ronda →";
        nextBtn.onclick = hostLaunchRound;
      }
    }
  } else {
    if (hintEl) hintEl.style.display = 'none';
    if (nextBtn) nextBtn.classList.add('hidden');
  }

  let html = `<table class="results-table"><thead><tr><th>Jugador</th>`;
  config.categories.forEach(c => {
    html += `<th>${c}</th>`;
  });
  html += `<th>Total</th></tr></thead><tbody>`;

  Object.entries(players).forEach(([id, p]) => {
    html += `<tr><td style="font-weight:700; color:var(--md-sys-color-primary);">${p.name}</td>`;

    config.categories.forEach(cat => {
      const word = (p.answers && p.answers[cat]) ? p.answers[cat] : "-";
      const pts = p.roundPts ? (p.roundPts[cat] || 0) : 0;
      const override = p.overrideMap ? p.overrideMap[cat] : undefined;

      let cellClass = "word-cell";
      let badgeText = `+${pts}`;
      let badgeClass = "pts-badge";

      if (pts === 0 || override === 'invalid') {
        cellClass += " invalid-ans";
        badgeText = "0";
        badgeClass += " zero";
      } else if (pts === 50 || override === 'half') {
        cellClass += " half-ans";
        badgeText = "+50";
        badgeClass += " half";
      } else {
        cellClass += " valid-ans";
        badgeText = `+${pts}`;
        badgeClass += " valid";
      }

      const onClickAttr = isHost ? `onclick="toggleOverrideWord('${id}', '${cat}')"` : "";

      html += `<td class="${cellClass}" ${onClickAttr} title="${isHost ? 'Toca para cambiar puntaje (Válida / Mitad / Anular)' : ''}">
        <span class="word-text">${word}</span>
        <span class="${badgeClass}">${badgeText}</span>
      </td>`;
    });

    html += `<td style="font-weight:900; color:var(--md-sys-color-secondary);">${p.total}</td></tr>`;
  });

  html += `</tbody></table>`;

  const resultsContent = document.getElementById('results-content');
  if (resultsContent) resultsContent.innerHTML = html;
}

function toggleOverrideWord(playerId, category) {
  if (!isHost) return;

  players[playerId].overrideMap = players[playerId].overrideMap || {};
  const current = players[playerId].overrideMap[category];

  if (!current || current === 'full' || current === 'valid') {
    players[playerId].overrideMap[category] = 'half';
    showToast('🟡 Palabra ajustada a 50 pts (Mitad de puntaje)', false);
  } else if (current === 'half') {
    players[playerId].overrideMap[category] = 'invalid';
    showToast('🔴 Palabra Anulada (0 pts - Tachada)', false);
  } else {
    players[playerId].overrideMap[category] = 'full';
    showToast('🟢 Palabra Restablecida a Válida (100 pts)', false);
  }

  calculateRoundPoints();
  broadcast({ type: 'RESULTS', players: players });
  renderResultsUI();
}

function checkFinalWinner() {
  let winner = null;
  let maxPts = -1;

  Object.values(players).forEach(p => {
    if (p.total > maxPts) {
      maxPts = p.total;
      winner = p;
    }
  });

  broadcast({ type: 'FINAL_VICTORY', winner: winner });
  showPodiumUI(winner);
}

function showPodiumUI(winner) {
  playSound('fanfare');
  triggerHaptic();

  const nameEl = document.getElementById('winner-name');
  const scoreEl = document.getElementById('winner-score');

  if (nameEl) nameEl.innerText = winner ? winner.name : 'Nadie';
  if (scoreEl) scoreEl.innerText = `${winner ? winner.total : 0} Puntos Totales`;

  showView('view-podium');
}

// --- HOST CONFIGURATION & PRESETS ---
function onCategoryPresetChanged() {
  if (!isHost) return;
  const select = document.getElementById('category-preset-select');
  const customBox = document.getElementById('custom-categories-box');
  if (!select) return;

  const val = select.value;
  if (val === 'custom') {
    if (customBox) customBox.classList.remove('hidden');
    onCustomCategoriesEntered();
  } else {
    if (customBox) customBox.classList.add('hidden');
    if (CATEGORY_PRESETS[val]) {
      config.categories = [...CATEGORY_PRESETS[val]];
      onHostSettingsChanged();
    }
  }
}

function onCustomCategoriesEntered() {
  if (!isHost) return;
  const input = document.getElementById('custom-categories-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const cats = raw.split(',').map(c => c.trim()).filter(c => c.length > 0);
  if (cats.length >= 2) {
    config.categories = cats;
    onHostSettingsChanged();
  } else {
    showToast('Ingresa al menos 2 categorías separadas por coma', true);
  }
}

function onHostSettingsChanged() {
  if (!isHost) return;
  const timerSelect = document.getElementById('timer-select');
  const roundsSelect = document.getElementById('rounds-select');
  const diffSelect = document.getElementById('ai-difficulty-select');

  if (timerSelect) config.timer = parseInt(timerSelect.value, 10);
  if (roundsSelect) config.maxRounds = parseInt(roundsSelect.value, 10);
  if (diffSelect) config.aiDifficulty = diffSelect.value;

  broadcast({
    type: 'SETTINGS_UPDATE',
    config: config
  });
}

// --- FLOATING REACTIONS SYSTEM (NON-INTRUSIVE) ---
function sendReaction(emoji) {
  if (!myName) return;
  showFloatingReaction(emoji, myName);
  playSound('beep');
  triggerHaptic();

  if (isHost) {
    broadcast({ type: 'REACTION', emoji, sender: myName });
  } else if (hostConn && hostConn.open) {
    hostConn.send({ type: 'REACTION', emoji, sender: myName });
  }
}

function showFloatingReaction(emoji, sender) {
  const stage = document.getElementById('reactions-floating-stage');
  if (!stage) return;

  const pill = document.createElement('div');
  pill.className = 'floating-reaction-pill';
  pill.innerHTML = `<span class="emoji">${emoji}</span><span>${sender}</span>`;

  // Posición horizontal aleatoria (10% a 80%) para evitar tapar elementos
  const randomX = Math.floor(Math.random() * 70) + 10;
  pill.style.left = `${randomX}%`;

  stage.appendChild(pill);

  setTimeout(() => {
    pill.remove();
  }, 2000);
}

// --- GEMINI AI JUDGE VALIDATION & DICTIONARY ---
let currentAiResultsCache = [];
let currentDictFilter = 'all';

async function runAIValidation() {
  const btn = document.getElementById('btn-validate-ai');
  if (!btn) return;

  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span> Juez IA Gemini analizando...`;
  btn.disabled = true;

  try {
    // Agrupar palabras únicas por Categoría + Palabra para no sobrecargar a la IA con duplicados
    let wordGroupMap = {};

    Object.entries(players).forEach(([id, p]) => {
      config.categories.forEach(cat => {
        const rawWord = p.answers ? p.answers[cat] : null;
        if (rawWord && rawWord.trim() !== '' && rawWord.trim() !== '-') {
          const cleanWord = rawWord.trim().toUpperCase();
          const key = `${cat}::${cleanWord}`;

          if (!wordGroupMap[key]) {
            wordGroupMap[key] = {
              category: cat,
              word: cleanWord,
              playerIds: [id],
              players: [p.name || id]
            };
          } else {
            if (!wordGroupMap[key].playerIds.includes(id)) {
              wordGroupMap[key].playerIds.push(id);
              wordGroupMap[key].players.push(p.name || id);
            }
          }
        }
      });
    });

    let answersToValidate = Object.values(wordGroupMap).map(item => ({
      category: item.category,
      word: item.word,
      players: item.players,
      playerIds: item.playerIds
    }));

    if (answersToValidate.length === 0) {
      showToast('No hay palabras escritas en esta ronda para evaluar.', true);
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      return;
    }

    const res = await fetch('/api/validate-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        letter: currentLetter,
        answers: answersToValidate
      })
    });

    if (!res.ok) {
      throw new Error('Error en el servidor de IA');
    }

    const data = await res.json();
    const aiResults = data.results || [];

    if (isHost) {
      aiResults.forEach(item => {
        const itemStatus = item.status || (item.valid === false ? 'invalid' : 'valid');

        // Aplicar dictamen a todos los jugadores que escribieron esta palabra en esta categoría
        Object.entries(players).forEach(([pId, p]) => {
          if (p.answers && p.answers[item.category] && p.answers[item.category].trim().toUpperCase() === item.word.trim().toUpperCase()) {
            p.overrideMap = p.overrideMap || {};
            p.overrideMap[item.category] = itemStatus;
          }
        });
      });

      calculateRoundPoints();
      broadcast({ type: 'RESULTS', players: players });
      broadcast({ type: 'AI_VALIDATION_RESULTS', aiResults: aiResults });
      renderResultsUI();
    }

    currentAiResultsCache = aiResults;
    renderAiDictionaryUI(aiResults);
    showToast('✨ Juez IA evaluó las palabras y generó el diccionario', false);
  } catch (err) {
    console.error('Error al evaluar con IA:', err);
    showToast('No se pudo conectar con el Juez IA Gemini', true);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

function filterDictionary(filterType) {
  currentDictFilter = filterType;

  ['all', 'valid', 'half', 'invalid'].forEach(f => {
    const btn = document.getElementById(`dict-filter-${f}`);
    if (btn) {
      if (f === filterType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  renderAiDictionaryUI(currentAiResultsCache);
}

function renderAiDictionaryUI(aiResults) {
  if (aiResults) currentAiResultsCache = aiResults;
  const resultsToRender = currentAiResultsCache || [];

  const container = document.getElementById('ai-dictionary-section');
  const listEl = document.getElementById('ai-dictionary-list');
  const badgeEl = document.getElementById('dict-count-badge');

  if (!container || !listEl) return;

  if (!resultsToRender || !Array.isArray(resultsToRender) || resultsToRender.length === 0) {
    container.classList.add('hidden');
    return;
  }

  // Filtrar según pestaña activa
  const filtered = resultsToRender.filter(res => {
    const status = res.status || (res.valid === false ? 'invalid' : 'valid');
    if (currentDictFilter === 'all') return true;
    return status === currentDictFilter;
  });

  if (badgeEl) badgeEl.innerText = `${filtered.length}/${resultsToRender.length}`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; opacity: 0.6; font-size: 13px; padding: 16px;">No hay palabras en esta categoría de filtro.</div>`;
    container.classList.remove('hidden');
    return;
  }

  let html = '';
  filtered.forEach(res => {
    let statusBadge = '';
    const status = res.status || (res.valid === false ? 'invalid' : 'valid');

    if (status === 'valid') {
      statusBadge = `<span style="background: rgba(0, 230, 118, 0.15); color: #00E676; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px;">✓ VÁLIDA (100 pts)</span>`;
    } else if (status === 'half') {
      statusBadge = `<span style="background: rgba(255, 171, 0, 0.15); color: #FFAB00; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px;">🟡 MITAD (50 pts)</span>`;
    } else {
      statusBadge = `<span style="background: rgba(255, 82, 82, 0.15); color: #FF5252; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px;">✗ INVÁLIDA (0 pts - Tachada)</span>`;
    }

    const playerListStr = (res.players && Array.isArray(res.players) && res.players.length > 0)
      ? res.players.join(', ')
      : (res.playerName || 'Jugadores');

    const cardBorderColor = status === 'valid' 
      ? 'rgba(0, 230, 118, 0.25)' 
      : status === 'half' 
        ? 'rgba(255, 171, 0, 0.25)' 
        : 'rgba(255, 82, 82, 0.25)';

    html += `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid ${cardBorderColor}; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
          <div style="font-weight: 800; font-size: 14px; color: var(--md-sys-color-primary);">
            <span style="text-decoration: ${status === 'invalid' ? 'line-through' : 'none'}; color: ${status === 'invalid' ? '#FF5252' : status === 'half' ? '#FFAB00' : 'inherit'};">${res.word}</span>
            <span style="font-size: 12px; font-weight: 600; opacity: 0.6; margin-left: 6px;">[${res.category}]</span>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div style="font-size: 12px; color: var(--md-sys-color-secondary); margin-bottom: 4px;">
          <strong>👤 Escrita por:</strong> ${playerListStr}
        </div>

        <div style="color: rgba(255, 255, 255, 0.9); margin-bottom: 4px;">
          <strong>📖 Definición:</strong> ${res.definition || 'Palabra o concepto evaluado.'}
        </div>

        <div style="font-size: 12px; opacity: 0.85; color: var(--md-sys-color-secondary);">
          <strong>💡 Dictamen:</strong> ${res.reason || (status === 'valid' ? 'Aceptada' : 'No válida')}
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  container.classList.remove('hidden');
}

// --- UTILS & BROADCAST ---
function broadcast(msg) {
  connections.forEach(c => {
    if (c.open) {
      try {
        c.send(msg);
      } catch (e) {
        console.warn('Error al transmitir a peer:', c.peer, e);
      }
    }
  });
}

// --- AUTO-REENGANCHE Y RECONEXIÓN AL VOLVER A LA PESTAÑA ---
window.addEventListener('beforeunload', () => {
  if (isHost) {
    broadcast({ type: 'HOST_LEFT' });
  } else if (hostConn && hostConn.open) {
    hostConn.send({ type: 'CLIENT_LEFT', peerId: myPeerId, name: myName });
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('El jugador volvió a la pantalla.');
    if (peer && peer.disconnected) {
      peer.reconnect();
    }
    if (!isHost && hostConn && hostConn.open) {
      hostConn.send({ type: 'RECONNECT_REQUEST', name: myName, peerId: myPeerId });
    }
  }
});
