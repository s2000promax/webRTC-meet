import React, { useCallback, useEffect, useRef } from 'react';
import useStateWithCallback from './useStateWithCallback';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import freeice from 'freeice';

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
          addNewClient(peerID, () => {
            // начинаем транслировать remoteStream
            peerMediaElements.current[peerID].srcObject = remoteStream;
          });
        }
      }

      // Добавляем локальный стрим к нашему peerConnection
      localMediaStream.current.getTracks().forEach(track => {
        peerConnection.current[peerID].addTrack(track, localMediaStream);
      });

      // Если мы сторона, которая создает offer, то
      if (createOffer) {
        const offer = await peerConnection.current[peerID].createOffer();

        // Устанавливаем offer как localDescription
        await peerConnection.current[peerID].setLocalDescription();

        // Отправляем offer
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer
        });
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);
  }, []);

  // Реагируем на sessionDescription
  useEffect(() => {
    async function setRemoteMedia({ peerID, sessionDescription: remoteDescription }) {
      await peerConnection.current[peerID].setRemoteDescription(
        new RTCSessionDescription(remoteDescription) // Оборачиваем констуртором RTCSessionDescription
      );

      if (remoteDescription.type === 'offer') {
        const answer = await peerConnection.current[peerID].createAnswer();

        await peerConnection.current[peerID].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer
        });
      }
    }

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)
  }, []);

  // Реагируем на iceCandidate
  useEffect(() => {

    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerID, iceCandidate }) => {
      peerConnection.current[peerID].addIceCandidate(
        new RTCIceCandidate() // Оборачиваем констуртором RTCIceCandidate
      );
    });
  }, []);

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

    // Действие при демонтировании
    return () => {
      localMediaStream.current.getTracks().forEach(track => track.stop());

      socket.emit(ACTIONS.LEAVE);
    }

  }, [roomID]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return { clients, provideMediaRef };
}

export default useWebRTC;
