import React, { useCallback, useEffect, useRef } from 'react';
import useStateWithCallback from './useStateWithCallback';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import freeice from 'freeice';
import { logDOM } from '@testing-library/react';

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

  const dataChannel = useRef({});

  const addNewClient = useCallback((newClient, cb) => {
    updateClients(list => {
      if (!list.includes(newClient)) {
        return [...list, newClient]
      }

      return list;
    }, cb);
  }, [clients, updateClients]);

  // Добавление нового соединения
  useEffect(() => {
    // Что мы будем делать, когда добавится новый peer
    async function handleNewPeer({ peerID, createOffer }) {
      if (peerID in peerConnection.current) {
        return console.warn(`Already connection to peer ${peerID}`);
      }

      peerConnection.current[peerID] = new RTCPeerConnection({
        iceServers: freeice()
      })

      peerConnection.current[peerID].ondatachannel = event => {
        dataChannel.current = event.channel;
        dataChannel.current.onopen = () => console.log('Channel opened!');
        dataChannel.current.onmessage = e => console.log('Message:', e.data);
      }


      // Когда новый iceCandidate желает подключится. handle event. Когда мы сами создаем или offer или answer
      peerConnection.current[peerID].onicecandidate = (event) => {
        if (event.candidate) {
          // если кандидат существует - Пересылаем другим клиентам
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate
          });
        }
      }

      // Извлекаем stream, когда приходит новый track
      let tracksNumber = 0; // Нам походит два трека - audio и video
      peerConnection.current[peerID].ontrack = ({ streams: [remoteStream] }) => {
        tracksNumber += 1; // Увеличиваем каждый раз, как приходит новый track

        if (tracksNumber === 2) { // ожидаем принятия audio и video !!!
          tracksNumber = 0;
          addNewClient(peerID, () => {
            if (peerMediaElements.current[peerID]) {
              // начинаем транслировать remoteStream
              peerMediaElements.current[peerID].srcObject = remoteStream;
            } else {
              let settled = false;
              const interval = setInterval(() => {
                if (peerMediaElements.current[peerID]) {
                  peerMediaElements.current[peerID].srcObject = remoteStream;
                  settled = true;
                }

                if (settled) {
                  clearInterval(interval);
                }
              }, 1000);
            }
          });
        }
      }

      // Добавляем локальный стрим к нашему peerConnection
      localMediaStream.current.getTracks().forEach(track => {
        peerConnection.current[peerID].addTrack(track, localMediaStream.current);
      });

      // Если мы сторона, которая создает offer, то
      if (createOffer) {
        dataChannel.current = peerConnection.current[peerID].createDataChannel('data-channel');
        dataChannel.current.onopen = () => console.log('DataChannel opened!');
        dataChannel.current.onmessage = event => console.log('Message: ', event.data);

        const offer = await peerConnection.current[peerID].createOffer();

        // Устанавливаем offer как localDescription
        await peerConnection.current[peerID].setLocalDescription(offer);

        // Отправляем offer
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer,
        });
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    return () => {
      socket.off(ACTIONS.ADD_PEER);
    }
  }, []);

  // Реагируем на sessionDescription
  useEffect(() => {
    async function setRemoteMedia({peerID, sessionDescription: remoteDescription}) {
      await peerConnection.current[peerID]?.setRemoteDescription(
        new RTCSessionDescription(remoteDescription) // Оборачиваем констуртором RTCSessionDescription
      );

      if (remoteDescription.type === 'offer') {
        const answer = await peerConnection.current[peerID].createAnswer();

        await peerConnection.current[peerID].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        });
      }
    }

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)

    return () => {
      socket.off(ACTIONS.SESSION_DESCRIPTION);
    }
  }, []);

  // Реагируем на iceCandidate
  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({peerID, iceCandidate}) => {
      peerConnection.current[peerID]?.addIceCandidate(
        new RTCIceCandidate(iceCandidate) // Оборачиваем констуртором RTCIceCandidate
      );
    });

    return () => {
      socket.off(ACTIONS.ICE_CANDIDATE);
    }
  }, []);

  // Удаление соединения
  useEffect(() => {
    const handleRemovePeer = ({ peerID }) => {
      if (peerConnection.current[peerID]) {
        peerConnection.current[peerID].close();
      }

      delete peerConnection.current[peerID];
      delete peerMediaElements.current[peerID];

      updateClients(list => list.filter(client => client !== peerID));
    }

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

    return () => {
      socket.off(ACTIONS.REMOVE_PEER);
    }
  }, []);

  // Реагируем на изменение комнаты
  useEffect(() => {

    // Захватываем медиа-контент
    async function startCapture() {
      localMediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 320,
          height: 200,
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

    // Действие при демонтировании
    return () => {
      localMediaStream.current.getTracks().forEach(track => track.stop());

      socket.emit(ACTIONS.LEAVE);
    }

  }, [roomID]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  const handleSendMessage = () => dataChannel.current.send('My message');

  console.log(dataChannel);
  return { clients, provideMediaRef, handleSendMessage };
}

export default useWebRTC;
