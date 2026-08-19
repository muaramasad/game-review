import { DataSource } from 'typeorm';
import { Game } from '../games/entities/game.entity';
import { Review } from '../reviews/entities/review.entity';

interface SeedReview {
  reviewerName: string;
  rating: number;
  text: string;
}

interface SeedGame {
  title: string;
  genre: string;
  platform: string;
  description: string;
  reviews: SeedReview[];
}

const seedGames: SeedGame[] = [
  {
    title: 'Elden Ring',
    genre: 'Action RPG',
    platform: 'PC',
    description:
      'An open-world action RPG set in the Lands Between, created by FromSoftware and George R. R. Martin.',
    reviews: [
      {
        reviewerName: 'Alice',
        rating: 5,
        text: 'Best open-world game I have ever played.',
      },
      {
        reviewerName: 'Bob',
        rating: 4,
        text: 'Incredible world design, though the difficulty spikes are brutal.',
      },
    ],
  },
  {
    title: 'Hades',
    genre: 'Roguelike',
    platform: 'PC',
    description:
      'A rogue-like dungeon crawler where you defy the god of the dead as you hack and slash out of the Underworld.',
    reviews: [
      {
        reviewerName: 'Carla',
        rating: 5,
        text: 'Addictive gameplay loop and amazing writing.',
      },
      {
        reviewerName: 'Dan',
        rating: 5,
        text: 'The art style and soundtrack are outstanding.',
      },
      {
        reviewerName: 'Elena',
        rating: 4,
        text: 'Great replayability, though the story took a while to click for me.',
      },
    ],
  },
  {
    title: 'The Witcher 3',
    genre: 'Action RPG',
    platform: 'PC',
    description:
      'Geralt of Rivia hunts monsters and gets tangled up in politics across a vast, richly detailed open world.',
    reviews: [
      {
        reviewerName: 'Frank',
        rating: 5,
        text: 'One of the best stories in gaming.',
      },
      {
        reviewerName: 'Grace',
        rating: 5,
        text: 'Side quests are more compelling than most games main stories.',
      },
    ],
  },
  {
    title: 'Cyberpunk 2077',
    genre: 'Action RPG',
    platform: 'PC',
    description:
      'An open-world, action-adventure story set in Night City, a megalopolis obsessed with power and body modification.',
    reviews: [
      {
        reviewerName: 'Hana',
        rating: 4,
        text: 'Much improved since launch — Night City feels alive now.',
      },
      {
        reviewerName: 'Ivan',
        rating: 3,
        text: 'Great atmosphere but still runs into the occasional bug.',
      },
    ],
  },
  {
    title: 'Stardew Valley',
    genre: 'Simulation',
    platform: 'PC',
    description:
      'Inherit your grandfather’s old farm plot and turn it into a thriving home through farming, fishing, and friendship.',
    reviews: [
      {
        reviewerName: 'Jade',
        rating: 5,
        text: 'So relaxing, I keep coming back to it every year.',
      },
      {
        reviewerName: 'Kevin',
        rating: 5,
        text: 'Way more depth than I expected from a farming sim.',
      },
      {
        reviewerName: 'Liam',
        rating: 4,
        text: 'Charming and cozy, great for winding down after work.',
      },
    ],
  },
];

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const gameRepo = dataSource.getRepository(Game);
  const existingCount = await gameRepo.count();
  if (existingCount > 0) {
    return;
  }

  const reviewRepo = dataSource.getRepository(Review);

  for (const seedGame of seedGames) {
    const game = await gameRepo.save(
      gameRepo.create({
        title: seedGame.title,
        genre: seedGame.genre,
        platform: seedGame.platform,
        description: seedGame.description,
      }),
    );

    for (const review of seedGame.reviews) {
      await reviewRepo.save(
        reviewRepo.create({
          gameId: game.id,
          reviewerName: review.reviewerName,
          rating: review.rating,
          text: review.text,
        }),
      );
    }
  }
}
