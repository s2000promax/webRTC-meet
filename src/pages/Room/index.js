import React from 'react';
import { useParams } from 'react-router';
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC';

function layout(clientsNumber = 1) {
  // before: ['1', '2', '3', '4', '5']
  // after: [['1', '2'], ['3', '4'], ['5']]
  const pairs = Array.from({ length: clientsNumber }).reduce((acc, next, index, arr) => {
    if (index % 2 === 0) {
      acc.push(arr.slice(index, index + 2));
    }

    return acc;
  }, []);

  // Узнаем количество пар
  const rowsNumber = pairs.length;

  // Вычисляем высоту для потока
  const height = `${100 / rowsNumber}%`;

  return pairs.map((row, index, arr) => {
    if (index === arr.length - 1 && row.length === 1) {
      // Если в паре находится только 1 элемент
      return [{
        width: '100%',
        height
      }]
    }

    // Если в паре находятся 2 элемента
    return row.map(() => ({
      width: '50%',
      height
    }));
  }).flat(); // убираем вложенность (1 уровень вложенности)
}

const Room = () => {
  const { id: roomID } = useParams();
  const { clients, provideMediaRef } = useWebRTC(roomID);
  const videoLayout = layout(clients.length);
  console.log(roomID, clients);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      height: '100vh'
    }}>
      {clients.map((clientID, index) => {
        return (
          <div key={clientID} style={videoLayout[index]}>
            <video
              width='100%'
              height='100%'
              ref={instance => {
                provideMediaRef(clientID, instance);
              }}
              autoPlay
              playsInline
              muted={clientID === LOCAL_VIDEO}
            />
          </div>
        );
      })}
    </div>
  );
}

export default Room;
