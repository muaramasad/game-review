import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Review } from '../../reviews/entities/review.entity';

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  genre?: string;

  @Column({ nullable: true })
  platform?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => Review, (review) => review.game)
  reviews?: Review[];
}
