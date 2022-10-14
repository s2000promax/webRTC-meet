import React, { useEffect, useRef } from 'react';

const useWebRTC = (roomID) => {
  const [clients, updateClients] = useStateWithCallback([]);

  // храним все peerConnection (мутабельный объект) - поэтому не можем хранить в state
  const peerConnection = useRef({});
  // ссылка на локальный медиапоток (видео + аудио)
  const localMediaSream = useRef(null);
  // ссылка на всё peerMedia элементы
  const peerMediaElements = useRef({});

  useEffect(() => {
  }, []);


}

export default useWebRTC;
