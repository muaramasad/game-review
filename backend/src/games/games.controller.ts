import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GamesService } from './games.service';
import { Game } from './entities/game.entity';
import { Review } from '../reviews/entities/review.entity';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  findAll(): Promise<Game[]> {
    return this.gamesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Game> {
    return this.gamesService.findOne(id);
  }

  @Get(':id/reviews')
  findReviews(@Param('id', ParseIntPipe) id: number): Promise<Review[]> {
    return this.gamesService.findReviews(id);
  }
}
