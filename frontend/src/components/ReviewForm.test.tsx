import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewForm } from './ReviewForm';
import * as api from '../services/api';

vi.mock('../services/api');

describe('ReviewForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders reviewer name, rating, and text fields with a submit button', () => {
    render(<ReviewForm gameId="1" onReviewCreated={vi.fn()} />);

    expect(screen.getByLabelText(/reviewer name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/review text/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('only offers ratings 1 through 5', () => {
    render(<ReviewForm gameId="1" onReviewCreated={vi.fn()} />);

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['1', '2', '3', '4', '5']);
  });

  it('blocks submission when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<ReviewForm gameId="1" onReviewCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(api.createReview).not.toHaveBeenCalled();
  });

  it('submits the correct payload and reports the created review', async () => {
    const user = userEvent.setup();
    const onReviewCreated = vi.fn();
    const createdReview = {
      id: 1,
      gameId: 1,
      reviewerName: 'John',
      rating: 5,
      text: 'Amazing game.',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(api.createReview).mockResolvedValue(createdReview);

    render(<ReviewForm gameId="1" onReviewCreated={onReviewCreated} />);

    await user.type(screen.getByLabelText(/reviewer name/i), 'John');
    await user.selectOptions(screen.getByLabelText(/rating/i), '5');
    await user.type(screen.getByLabelText(/review text/i), 'Amazing game.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(api.createReview).toHaveBeenCalledWith('1', {
      reviewerName: 'John',
      rating: 5,
      text: 'Amazing game.',
    });
    expect(onReviewCreated).toHaveBeenCalledWith(createdReview);
  });
});
