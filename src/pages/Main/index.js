import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ACTIONS from '../../socket/actions';
import socket from '../../socket/index';
import { v4 } from 'uuid';

const Main = () => {
  const history = useNavigate();
  const [rooms, updateRooms] = useState([]);

  useEffect(() => {
    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms = [] }) => {
      updateRooms(rooms);
    });
  }, []);

  console.log(rooms)
  return (
    <div>
      <h1>Available Rooms</h1>\
      <ul>
        {rooms.map(roomID => (
          <div key={`id-li-${roomID}`}>
            <li>{roomID}</li>
            <button
              onClick={() => {
                history(`/room/${roomID}`)
              }}

            >Join Room
            </button>
          </div>
        ))}
      </ul>
      <button
        onClick={() => {
          history(`/room/${v4()}`)
        }}
      >Create New Room
      </button>
    </div>
  );
}

export default Main;
