import type { Game } from '../types/game';
import type { Review } from '../types/review';

export async function fetchGames(): Promise<Game[]> {
  const res = await fetch('/api/games');
  if (!res.ok) {
    throw new Error(`Failed to fetch games (${res.status})`);
  }
  return res.json();
}

export async function fetchGame(id: string): Promise<Game> {
  const res = await fetch(`/api/games/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch game (${res.status})`);
  }
  return res.json();
}

export async function fetchReviews(gameId: string): Promise<Review[]> {
  const res = await fetch(`/api/games/${gameId}/reviews`);
  if (!res.ok) {
    throw new Error(`Failed to fetch reviews (${res.status})`);
  }
  return res.json();
}
