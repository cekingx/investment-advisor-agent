import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('sectoral_indicators')
export class SectoralIndicator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  sector: string;

  @Column({ length: 50 })
  code: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  value: number;

  @Column({ length: 20, nullable: true })
  unit: string;

  @Column({ length: 50 })
  source: string;

  @Column({ type: 'date' })
  periodDate: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  fetchedAt: Date;
}
