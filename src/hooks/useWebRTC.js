import React, { useCallback, useEffect, useRef } from 'react';
import useStateWithCallback from './useStateWithCallback';
import socket from '../socket';
import ACTIONS from '../socket/actions';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

const useWebRTC = (roomID) => {
  const [clients, updateClients] = useStateWithCallback([]);

  // храним все peerConnection (мутабельный объект) - поэтому не можем хранить в state
  const peerConnection = useRef({});
  // ссылка на локальный медиапоток (видео + аудио)
  const localMediaStream = useRef(null);
  // ссылка на всё peerMedia элементы
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null
  });

  const addNewClient = useCallback((newClient, cb) => {
    updateClients(list => {
      if (!list.includes(newClient)) {
        return [...list, newClient]
      }

      return list;
    }, cb);
  }, [clients, updateClients]);

  // Реагируем на изменение комнаты
  useEffect(() => {

    // Захватываем медиа-контент
    async function startCapture() {
      localMediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
        }
      });

      addNewClient(LOCAL_VIDEO, () => {
        const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

        if (localVideoElement) {
          localVideoElement.volume = 0; // Чтобы не слышать самого себя
          localVideoElement.srcObject = localMediaStream.current;
        }
      });
    }


    startCapture()
      .then(() => socket.emit(ACTIONS.JOIN, { room: roomID }))
      .catch(e => console.error('Error getting userMedia:', e));

  }, [roomID]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return { clients, provideMediaRef };
}

export default useWebRTC;
