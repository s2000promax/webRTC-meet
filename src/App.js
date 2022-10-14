import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Main from './pages/Main/index';
import Room from './pages/Room/index';
import _404 from './pages/_404/index';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path='/' element={<Main/>}/>
        <Route exact path='/room/:id' element={<Room/>}/>
        <Route path='*' element={<_404/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
