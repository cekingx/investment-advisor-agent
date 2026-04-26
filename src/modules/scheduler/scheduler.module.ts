import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { TemporalModule } from '../../temporal/temporal.module';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), TemporalModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
