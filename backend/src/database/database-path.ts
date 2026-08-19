import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

export function getDatabasePath(): string {
  const path =
    process.env.DATABASE_PATH ?? join(__dirname, '..', '..', 'data', 'game-review.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  return path;
}
