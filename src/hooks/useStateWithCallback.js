import { useState, useCallback, useRef, useEffect } from 'react';

// аналог this.setState из классовых компонентов, только на функциональных компонентах
const useStateWithCallback = initialState => {
  const [state, setState] = useState(initialState);
  const cbRef = useRef();

  // функция обновления state
  const updateState = useCallback((newState, cb) => {
    cbRef.current = cb;

    setState(prevState => typeof newState === 'function' ? newState(prevState) : newState);
  }, []);

  // Реагируем на изменение state - вызываем cb-функцию
  useEffect(() => {
    if (cbRef.current) {
      cbRef.current(state); // Вызываем cb-функцию с текущим state
      cbRef.current = null; // Перезатираем функцию
    }
  }, [state]);

  return [state, updateState];
}

export default useStateWithCallback;
