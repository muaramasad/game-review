import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GameDetailsPage } from './GameDetailsPage';
import * as api from '../services/api';

vi.mock('../services/api');

const game = {
  id: 1,
  title: 'Elden Ring',
  genre: 'Action RPG',
  platform: 'PC',
  description: 'An open-world action RPG.',
};

const existingReviews = [
  {
    id: 1,
    gameId: 1,
    reviewerName: 'Alice',
    rating: 5,
    text: 'Best open-world game.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/games/1']}>
      <Routes>
        <Route path="/games/:id" element={<GameDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GameDetailsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchGame).mockResolvedValue(game);
    vi.mocked(api.fetchReviews).mockResolvedValue(existingReviews);
  });

  it('renders game info and existing reviews', async () => {
    renderPage();

    expect(await screen.findByText('Elden Ring')).toBeInTheDocument();
    expect(screen.getByText(/Action RPG/)).toBeInTheDocument();
    expect(screen.getByText(/PC/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Best open-world game.')).toBeInTheDocument();
  });

  it('shows a newly submitted review immediately, without a page reload', async () => {
    const user = userEvent.setup();
    const newReview = {
      id: 2,
      gameId: 1,
      reviewerName: 'Bob',
      rating: 4,
      text: 'Great sequel material.',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    vi.mocked(api.createReview).mockResolvedValue(newReview);

    renderPage();
    await screen.findByText('Elden Ring');

    await user.type(screen.getByLabelText(/reviewer name/i), 'Bob');
    await user.selectOptions(screen.getByLabelText(/rating/i), '4');
    await user.type(screen.getByLabelText(/review text/i), 'Great sequel material.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
    expect(screen.getByText('Great sequel material.')).toBeInTheDocument();
    // Existing review is still there too — new one was added, not replaced.
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // fetchReviews was only called once (initial load) — the new review
    // appeared via local state update, not a re-fetch.
    expect(api.fetchReviews).toHaveBeenCalledTimes(1);
  });
});
