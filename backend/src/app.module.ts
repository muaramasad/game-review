import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabasePath } from './database/database-path';
import { Game } from './games/entities/game.entity';
import { Review } from './reviews/entities/review.entity';
import { GamesModule } from './games/games.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: getDatabasePath(),
      entities: [Game, Review],
      autoLoadEntities: true,
      synchronize: true,
    }),
    GamesModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
