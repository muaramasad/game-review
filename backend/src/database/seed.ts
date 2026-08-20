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
  {
    title: 'Cities: Skylines',
    genre: 'City Builder',
    platform: 'PC',
    description:
      'A modern take on the city-building simulation, giving you full control over zoning, traffic, and public services as your city grows.',
    reviews: [
      {
        reviewerName: 'Marco',
        rating: 5,
        text: 'The traffic simulation alone will eat your whole weekend.',
      },
      {
        reviewerName: 'Nadia',
        rating: 4,
        text: 'Deep and rewarding, though it can get overwhelming with all the mods.',
      },
    ],
  },
  {
    title: 'BeamNG.drive',
    genre: 'Driving Simulation',
    platform: 'PC',
    description:
      'A vehicle simulator built around a realistic soft-body physics engine, letting you crash, tune, and drive with genuinely dynamic damage.',
    reviews: [
      {
        reviewerName: 'Owen',
        rating: 5,
        text: 'The crash physics are unmatched — nothing else comes close.',
      },
      {
        reviewerName: 'Priya',
        rating: 4,
        text: 'Amazing sandbox, though it still feels early-access in places.',
      },
      {
        reviewerName: 'Quentin',
        rating: 5,
        text: 'I bought it for the crashes and stayed for the career mode.',
      },
    ],
  },
  {
    title: 'Euro Truck Simulator 2',
    genre: 'Simulation',
    platform: 'PC',
    description:
      'Build a trucking business and haul cargo across a detailed recreation of Europe’s highways and cities.',
    reviews: [
      {
        reviewerName: 'Rosa',
        rating: 5,
        text: 'Somehow the most relaxing game I own — perfect with a podcast on.',
      },
      {
        reviewerName: 'Sam',
        rating: 4,
        text: 'The map DLCs are pricey but the driving model keeps me coming back.',
      },
    ],
  },
  {
    title: 'Stranded Deep',
    genre: 'Survival',
    platform: 'PC',
    description:
      'Stranded in the middle of the Pacific after a plane crash, you must build, craft, and explore to survive on a set of procedurally generated islands.',
    reviews: [
      {
        reviewerName: 'Tara',
        rating: 4,
        text: 'Great survival tension, especially the first time a shark shows up.',
      },
      {
        reviewerName: 'Umar',
        rating: 3,
        text: 'Fun loop but starts to feel repetitive after the first few islands.',
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
