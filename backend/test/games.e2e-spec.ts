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

describe('Games (e2e)', () => {
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

  it('GET /api/games returns the list of games', async () => {
    const gameRepo = dataSource.getRepository(Game);
    await gameRepo.save(gameRepo.create({ title: 'Elden Ring' }));
    await gameRepo.save(gameRepo.create({ title: 'Hades' }));

    const res = await request(app.getHttpServer()).get('/api/games').expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body.map((g: Game) => g.title).sort()).toEqual(['Elden Ring', 'Hades']);
  });

  it('GET /api/games/:id returns the requested game', async () => {
    const gameRepo = dataSource.getRepository(Game);
    const game = await gameRepo.save(gameRepo.create({ title: 'Elden Ring' }));

    const res = await request(app.getHttpServer())
      .get(`/api/games/${game.id}`)
      .expect(200);

    expect(res.body.id).toBe(game.id);
    expect(res.body.title).toBe('Elden Ring');
  });

  it('GET /api/games/:id returns 404 for a nonexistent game', async () => {
    const res = await request(app.getHttpServer()).get('/api/games/999').expect(404);

    expect(res.body.statusCode).toBe(404);
  });
});
