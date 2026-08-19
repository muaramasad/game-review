import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameListPage } from './pages/GameListPage';
import { GameDetailsPage } from './pages/GameDetailsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameListPage />} />
        <Route path="/games/:id" element={<GameDetailsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
