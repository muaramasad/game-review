import { useState } from 'react';
import type { FormEvent } from 'react';
import { createReview } from '../services/api';
import type { Review } from '../types/review';

interface ReviewFormProps {
  gameId: string;
  onReviewCreated: (review: Review) => void;
}

export function ReviewForm({ gameId, onReviewCreated }: ReviewFormProps) {
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const review = await createReview(gameId, { reviewerName, rating, text });
      onReviewCreated(review);
      setReviewerName('');
      setRating(5);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p role="alert">Error: {error}</p>}

      <label>
        Reviewer name
        <input
          type="text"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          required
        />
      </label>

      <label>
        Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label>
        Review text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
