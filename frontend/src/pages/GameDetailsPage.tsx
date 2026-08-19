import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchGame } from '../services/api';
import type { Game } from '../types/game';

export function GameDetailsPage() {
  const { id } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchGame(id)
      .then(setGame)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main>
      <Link to="/">Back to games</Link>

      {loading && <p>Loading game...</p>}
      {error && <p>Error: {error}</p>}

      {game && (
        <>
          <h1>{game.title}</h1>
          {game.genre && <p>Genre: {game.genre}</p>}
          {game.platform && <p>Platform: {game.platform}</p>}
          {game.description && <p>{game.description}</p>}

          <section>
            <h2>Reviews</h2>
            <p>Reviews coming soon.</p>
          </section>

          <section>
            <h2>Leave a review</h2>
            <p>Review form coming soon.</p>
          </section>
        </>
      )}
    </main>
  );
}
