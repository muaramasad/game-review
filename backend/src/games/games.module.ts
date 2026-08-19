import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { Review } from '../reviews/entities/review.entity';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Review])],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
