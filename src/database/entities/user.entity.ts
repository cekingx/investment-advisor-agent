import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'bigint',
    unique: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  chatId: number;

  @Column({ default: true })
  subscribed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
