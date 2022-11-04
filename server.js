const path = require('path');

const express = require('express');
const app = express();

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 3001;
const ACTIONS = require('./src/socket/actions');

const { version, validate } = require('uuid');

function getClientRooms() {
  const { rooms } = io.sockets.adapter;
  // console.log(Array.from(rooms.keys()).filter(roomID => roomID === '0xFF'));

  // Оставляем id комнаты другого клиента, не себя
  // return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4);
  return Array.from(rooms.keys()).filter(roomID => roomID === '0xFF');
}

function shareRoomsInfo() {
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClientRooms()
  });
}

io.on('connection', socket => {
  console.log('Socket connected');

  shareRoomsInfo();

  // Присоединение к комнате
  socket.on(ACTIONS.JOIN, config => {
    const { room: roomID } = config;
    const { rooms: joinedRooms } = socket;

    console.log('JOIN', roomID, joinedRooms);

    if (Array.from(joinedRooms).includes(roomID)) {
      return console.warn(`Already joined to ${roomID}`)
    }

    // Получаем всех клиентов в текущей комнате или пустой массив, если никого в комнате нет
    const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
    console.log(clients);

    clients.forEach(clientID => {
      // текущему сокету отправляем ACTION.ADD_PEER - id текущего КЛИЕНТА и что ему нужно создать offer
      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        createOffer: true
      });

      // Каждому клиенту отправляем ACTION.ADD_PEER -id текущего сокета и что ему не нужно создавать offer
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false
      });

    });

    // Подключаемся к комнате
    socket.join(roomID);

    // Делимся информацией о всех комнатах
    shareRoomsInfo();
  });

  // Выход из комнаты
  function leaveRoom() {
    const { rooms } = socket;

    Array.from(rooms).forEach(roomID => {
      const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

      clients.forEach(clientID => {
        // оповещаем каждого клиента, что мы выходим
        io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
          peerID: socket.id,
        })

        // текущему сокету (самому себе) отправим id клиента
        socket.emit(ACTIONS.REMOVE_PEER, {
          peerID: clientID
        });
      });

      socket.leave(roomID);
    });

    shareRoomsInfo();
  }

  socket.on(ACTIONS.LEAVE, leaveRoom);
  socket.on('disconnecting', leaveRoom);

  socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }) => {
    console.log('SDP:', peerID);
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription
    });

  });

  socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }) => {
    console.log('ICE:', peerID);
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate
    });
  });

  socket.on('data-channel', ({ peerID, dataChannel }) => {
    console.log('data-channel:', peerID);
  });


});

server.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});

