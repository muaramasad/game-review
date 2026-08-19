import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GamesModule } from '../src/games/games.module';
import { ReviewsModule } from '../src/reviews/reviews.module';
import { Game } from '../src/games/entities/game.entity';
import { Review } from '../src/reviews/entities/review.entity';

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Game, Review],
          synchronize: true,
        }),
        GamesModule,
        ReviewsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(Review).clear();
    await dataSource.getRepository(Game).clear();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createGame(): Promise<Game> {
    const gameRepo = dataSource.getRepository(Game);
    return gameRepo.save(gameRepo.create({ title: 'Elden Ring' }));
  }

  it('creates a valid review for an existing game', async () => {
    const game = await createGame();

    const res = await request(app.getHttpServer())
      .post(`/api/games/${game.id}/reviews`)
      .send({ reviewerName: 'John', rating: 5, text: 'Amazing game.' })
      .expect(201);

    expect(res.body).toMatchObject({
      gameId: game.id,
      reviewerName: 'John',
      rating: 5,
      text: 'Amazing game.',
    });
  });

  it('rejects an invalid rating', async () => {
    const game = await createGame();

    await request(app.getHttpServer())
      .post(`/api/games/${game.id}/reviews`)
      .send({ reviewerName: 'John', rating: 6, text: 'Amazing game.' })
      .expect(400);
  });

  it('rejects a missing reviewer name', async () => {
    const game = await createGame();

    await request(app.getHttpServer())
      .post(`/api/games/${game.id}/reviews`)
      .send({ rating: 5, text: 'Amazing game.' })
      .expect(400);
  });

  it('rejects missing review text', async () => {
    const game = await createGame();

    await request(app.getHttpServer())
      .post(`/api/games/${game.id}/reviews`)
      .send({ reviewerName: 'John', rating: 5 })
      .expect(400);
  });

  it('rejects a review for a nonexistent game', async () => {
    await request(app.getHttpServer())
      .post('/api/games/999/reviews')
      .send({ reviewerName: 'John', rating: 5, text: 'Amazing game.' })
      .expect(404);
  });

  it('retrieves reviews for a game', async () => {
    const game = await createGame();
    const reviewRepo = dataSource.getRepository(Review);
    await reviewRepo.save(
      reviewRepo.create({
        gameId: game.id,
        reviewerName: 'Alice',
        rating: 4,
        text: 'Great game.',
      }),
    );

    const res = await request(app.getHttpServer())
      .get(`/api/games/${game.id}/reviews`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].reviewerName).toBe('Alice');
  });

  it('makes a newly submitted review immediately available without a restart', async () => {
    const game = await createGame();

    await request(app.getHttpServer())
      .post(`/api/games/${game.id}/reviews`)
      .send({ reviewerName: 'John', rating: 5, text: 'Amazing game.' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/games/${game.id}/reviews`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].reviewerName).toBe('John');
  });
});
