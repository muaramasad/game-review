import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchGame, fetchReviews } from '../services/api';
import type { Game } from '../types/game';
import type { Review } from '../types/review';
import { ReviewList } from '../components/ReviewList';
import { ReviewForm } from '../components/ReviewForm';

export function GameDetailsPage() {
  const { id } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchGame(id), fetchReviews(id)])
      .then(([gameResult, reviewsResult]) => {
        setGame(gameResult);
        setReviews(reviewsResult);
      })
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
            <ReviewList reviews={reviews} />
          </section>

          <section>
            <h2>Leave a review</h2>
            <ReviewForm
              gameId={id!}
              onReviewCreated={(review) => setReviews((prev) => [review, ...prev])}
            />
          </section>
        </>
      )}
    </main>
  );
}
