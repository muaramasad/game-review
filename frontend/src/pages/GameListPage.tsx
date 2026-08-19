import { useEffect, useState } from 'react';
import { fetchGames } from '../services/api';
import type { Game } from '../types/game';
import { GameCard } from '../components/GameCard';

export function GameListPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading games...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <main>
      <h1>Games</h1>
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </main>
  );
}
