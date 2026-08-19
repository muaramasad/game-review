import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

@Controller('games/:gameId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviewsService.create(gameId, dto);
  }
}
