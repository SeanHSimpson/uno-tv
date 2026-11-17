const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createDeck() {
  const colors = ['red', 'yellow', 'green', 'blue'];
  const deck = [];

  colors.forEach(color => {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i) });
      deck.push({ color, value: String(i) });
    }
    ['skip', 'reverse', 'draw2'].forEach(action => {
      deck.push({ color, value: action });
      deck.push({ color, value: action });
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild' });
    deck.push({ color: 'wild', value: 'wild4' });
  }

  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getPublicState(room) {
  return {
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      saidUno: p.saidUno,
      isHost: p.isHost
    })),
    discardTop: room.discard[room.discard.length - 1] || null,
    currentColor: room.currentColor,
    currentPlayerIndex: room.currentPlayerIndex,
    direction: room.direction,
    gameStarted: room.gameStarted,
    winner: room.winner,
    drawPileCount: room.drawPile.length,
    roomCode: room.code
  };
}

io.on('connection', (socket) => {
  socket.on('create-room', (data) => {
    const code = generateRoomCode();
    const room = {
      code,
      players: [],
      drawPile: [],
      discard: [],
      currentColor: null,
      currentPlayerIndex: 0,
      direction: 1,
      gameStarted: false,
      winner: null,
      hostId: socket.id
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.isTV = true;
    io.to(code).emit('room-created', { code, localIP: getLocalIP() });
    socket.emit('state', getPublicState(room));
  });

  socket.on('join-room', ({ code, name, role }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (role === 'player' && room.gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }

    const player = {
      id: socket.id,
      name: name || `Player ${room.players.length + 1}`,
      hand: [],
      saidUno: false,
      isHost: false
    };

    if (role === 'tv') {
      socket.isTV = true;
    } else {
      room.players.push(player);
      socket.isPlayer = true;
    }

    socket.join(code);
    socket.roomCode = code;
    socket.playerId = socket.id;

    io.to(code).emit('player-joined', { name: player.name });
    io.to(code).emit('state', getPublicState(room));
    if (socket.isPlayer) {
      socket.emit('hand', player.hand);
    }
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || socket.id !== room.hostId) return;
    if (room.players.length < 2) {
      socket.emit('error', 'Need at least 2 players');
      return;
    }

    room.drawPile = createDeck();
    room.discard = [];
    room.gameStarted = true;
    room.winner = null;
    room.direction = 1;
    room.currentPlayerIndex = 0;

    // Deal 7 cards
    room.players.forEach(player => {
      player.hand = [];
      player.saidUno = false;
      for (let i = 0; i < 7; i++) {
        player.hand.push(room.drawPile.pop());
      }
    });

    // Start discard
    let startCard;
    do {
      startCard = room.drawPile.pop();
    } while (startCard.value === 'wild' || startCard.value === 'wild4');
    room.discard.push(startCard);
    room.currentColor = startCard.color;

    room.players.forEach(p => {
      io.to(p.id).emit('hand', p.hand);
    });
    io.to(socket.roomCode).emit('state', getPublicState(room));
    io.to(socket.roomCode).emit('game-started');
  });

  socket.on('play-card', ({ cardIndex, chosenColor }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.currentPlayerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }

    const player = room.players[playerIndex];
    const card = player.hand[cardIndex];
    if (!card) return;

    const top = room.discard[room.discard.length - 1];
    const canPlay = card.color === 'wild' ||
                    card.color === room.currentColor ||
                    card.value === top.value;

    if (!canPlay) {
      socket.emit('error', 'Invalid card');
      return;
    }

    // Play the card
    player.hand.splice(cardIndex, 1);
    room.discard.push(card);

    if (card.color === 'wild') {
      room.currentColor = chosenColor || 'red';
    } else {
      room.currentColor = card.color;
    }

    // Handle actions
    let skipNext = false;
    let drawCount = 0;

    if (card.value === 'skip') skipNext = true;
    if (card.value === 'reverse') {
      room.direction *= -1;
      if (room.players.length === 2) skipNext = true;
    }
    if (card.value === 'draw2') drawCount = 2;
    if (card.value === 'wild4') drawCount = 4;

    // UNO check
    if (player.hand.length === 1) {
      player.saidUno = true; // Auto for simplicity, or require call
    } else {
      player.saidUno = false;
    }

    // Move to next
    room.currentPlayerIndex = (room.currentPlayerIndex + room.direction + room.players.length) % room.players.length;
    if (skipNext) {
      room.currentPlayerIndex = (room.currentPlayerIndex + room.direction + room.players.length) % room.players.length;
    }

    // Apply draws to the next player
    if (drawCount > 0) {
      const nextPlayer = room.players[room.currentPlayerIndex];
      for (let i = 0; i < drawCount; i++) {
        if (room.drawPile.length === 0) reshuffle(room);
        if (room.drawPile.length > 0) nextPlayer.hand.push(room.drawPile.pop());
      }
    }

    // Check win
    if (player.hand.length === 0) {
      room.winner = player.name;
      room.gameStarted = false;
    }

    // Broadcast
    room.players.forEach(p => {
      io.to(p.id).emit('hand', p.hand);
    });
    io.to(socket.roomCode).emit('state', getPublicState(room));
  });

  socket.on('draw-card', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted) return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.currentPlayerIndex) return;

    const player = room.players[playerIndex];
    if (room.drawPile.length === 0) reshuffle(room);
    if (room.drawPile.length > 0) {
      player.hand.push(room.drawPile.pop());
    }

    // After draw, pass turn
    room.currentPlayerIndex = (room.currentPlayerIndex + room.direction + room.players.length) % room.players.length;

    room.players.forEach(p => {
      io.to(p.id).emit('hand', p.hand);
    });
    io.to(socket.roomCode).emit('state', getPublicState(room));
  });

  socket.on('say-uno', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player && player.hand.length === 1) {
      player.saidUno = true;
      io.to(socket.roomCode).emit('state', getPublicState(room));
    }
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(socket.roomCode);
    } else {
      io.to(socket.roomCode).emit('state', getPublicState(room));
    }
  });
});

function reshuffle(room) {
  const top = room.discard.pop();
  room.drawPile = shuffle(room.discard);
  room.discard = [top];
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`UNO TV server running!`);
  console.log(`TV / Host: http://localhost:${PORT}`);
  console.log(`Phones on same network: http://${ip}:${PORT}`);
});
