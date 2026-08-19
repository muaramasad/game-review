import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Game } from '../games/entities/game.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async create(gameId: number, dto: CreateReviewDto): Promise<Review> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game with id ${gameId} not found`);
    }

    const review = this.reviewRepository.create({
      gameId,
      reviewerName: dto.reviewerName,
      rating: dto.rating,
      text: dto.text,
    });
    return this.reviewRepository.save(review);
  }
}
