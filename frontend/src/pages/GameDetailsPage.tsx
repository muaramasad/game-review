import { useParams, Link } from 'react-router-dom';

export function GameDetailsPage() {
  const { id } = useParams();

  return (
    <main>
      <Link to="/">Back to games</Link>
      <p>Game details for game #{id} coming soon.</p>
    </main>
  );
}
