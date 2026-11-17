const socket = io();
let isTV = false;
let myHand = [];
let currentState = null;
let pendingCardIndex = null;

const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const tvView = document.getElementById('tv-view');
const playerView = document.getElementById('player-view');

document.getElementById('create-btn').onclick = () => {
  isTV = true;
  socket.emit('create-room');
};

document.getElementById('join-btn').onclick = () => {
  const name = document.getElementById('name-input').value.trim() || 'Player';
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  if (!code) return alert('Enter room code');
  socket.emit('join-room', { code, name, role: 'player' });
};

socket.on('room-created', ({ code, localIP }) => {
  document.getElementById('room-code').textContent = code;
  document.getElementById('phone-url').textContent = `http://${localIP}:3000`;
  document.getElementById('create-section').style.display = 'none';
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('room-info').style.display = 'block';
  document.getElementById('start-btn').style.display = 'inline-block';
});

socket.on('state', (state) => {
  currentState = state;
  updateUI();
});

socket.on('hand', (hand) => {
  myHand = hand;
  renderHand();
});

socket.on('game-started', () => {
  lobby.style.display = 'none';
  game.style.display = 'block';
  if (isTV) {
    tvView.style.display = 'block';
    playerView.style.display = 'none';
  } else {
    tvView.style.display = 'none';
    playerView.style.display = 'block';
  }
});

socket.on('error', (msg) => alert(msg));

document.getElementById('start-btn').onclick = () => {
  socket.emit('start-game');
};

document.getElementById('draw-btn').onclick = () => {
  socket.emit('draw-card');
};

document.getElementById('uno-btn').onclick = () => {
  socket.emit('say-uno');
};

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.onclick = () => {
    const color = btn.dataset.color;
    if (pendingCardIndex !== null) {
      socket.emit('play-card', { cardIndex: pendingCardIndex, chosenColor: color });
      pendingCardIndex = null;
      document.getElementById('color-picker').style.display = 'none';
    }
  };
});

function updateUI() {
  if (!currentState) return;
  const { players, discardTop, currentColor, currentPlayerIndex, direction, gameStarted, winner, roomCode } = currentState;

  if (winner) {
    document.getElementById('status').textContent = `${winner} wins!`;
  } else if (gameStarted) {
    const current = players[currentPlayerIndex];
    document.getElementById('status').textContent = current ? `${current.name}'s turn` : '';
  }

  // Players status (for TV)
  const statusDiv = document.getElementById('players-status');
  if (statusDiv) {
    statusDiv.innerHTML = players.map((p, i) => `
      <div class="player-box ${i === currentPlayerIndex ? 'current' : ''}">
        <strong>${p.name}</strong><br>
        ${p.cardCount} cards
        ${p.saidUno ? ' 📣 UNO' : ''}
      </div>
    `).join('');
  }

  // Discard
  if (discardTop) {
    const cardEl = document.getElementById('discard-card');
    if (cardEl) {
      cardEl.className = `card ${discardTop.color}`;
      cardEl.textContent = formatCard(discardTop);
    }
    const colorInd = document.getElementById('color-indicator');
    if (colorInd) colorInd.textContent = `Current color: ${currentColor}`;
  }

  // Direction
  const dirEl = document.getElementById('direction');
  if (dirEl) dirEl.textContent = direction === 1 ? '→ Clockwise' : '← Counter-clockwise';

  // Players list in lobby
  const list = document.getElementById('players-list');
  if (list && !gameStarted) {
    list.innerHTML = players.map(p => `<div>${p.name}</div>`).join('');
  }
}

function renderHand() {
  const handDiv = document.getElementById('hand');
  if (!handDiv) return;
  handDiv.innerHTML = myHand.map((card, idx) => `
    <div class="card ${card.color}" data-index="${idx}" title="${formatCard(card)}">
      ${formatCard(card)}
    </div>
  `).join('');

  handDiv.querySelectorAll('.card').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.index);
      const card = myHand[idx];
      if (card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') {
        pendingCardIndex = idx;
        document.getElementById('color-picker').style.display = 'block';
      } else {
        socket.emit('play-card', { cardIndex: idx });
      }
    };
  });
}

function formatCard(card) {
  if (!card) return '';
  if (card.value === 'skip') return '⊘';
  if (card.value === 'reverse') return '↔';
  if (card.value === 'draw2') return '+2';
  if (card.value === 'wild') return 'W';
  if (card.value === 'wild4') return '+4';
  return card.value;
}
