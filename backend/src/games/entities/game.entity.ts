import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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
}
