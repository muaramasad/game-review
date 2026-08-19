import type { Review } from '../types/review';

interface ReviewListProps {
  reviews: Review[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p>No reviews yet.</p>;
  }

  return (
    <ul>
      {reviews.map((review) => (
        <li key={review.id}>
          <strong>{review.reviewerName}</strong> — {review.rating}/5
          <p>{review.text}</p>
          <time dateTime={review.createdAt}>
            {new Date(review.createdAt).toLocaleDateString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
