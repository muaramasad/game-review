import { Link } from 'react-router-dom';
import type { Game } from '../types/game';

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link to={`/games/${game.id}`}>
      <h2>{game.title}</h2>
      {game.genre && <p>Genre: {game.genre}</p>}
      {game.platform && <p>Platform: {game.platform}</p>}
    </Link>
  );
}
