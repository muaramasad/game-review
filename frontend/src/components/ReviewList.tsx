import type { Review } from '../types/review';

interface ReviewListProps {
  reviews: Review[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p>No reviews yet.</p>;
  }

  return (
    <ul className="review-list">
      {reviews.map((review) => (
        <li key={review.id} className="review-item">
          <div className="review-item-header">
            <strong>{review.reviewerName}</strong>
            <span className="review-rating">{review.rating}/5</span>
          </div>
          <p>{review.text}</p>
          <time dateTime={review.createdAt}>
            {new Date(review.createdAt).toLocaleDateString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
