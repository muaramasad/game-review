import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Review } from '../reviews/entities/review.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  findAll(): Promise<Game[]> {
    return this.gameRepository.find();
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gameRepository.findOne({ where: { id } });
    if (!game) {
      throw new NotFoundException(`Game with id ${id} not found`);
    }
    return game;
  }

  async findReviews(gameId: number): Promise<Review[]> {
    await this.findOne(gameId);
    return this.reviewRepository.find({
      where: { gameId },
      order: { createdAt: 'DESC' },
    });
  }
}
