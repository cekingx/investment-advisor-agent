import { Controller, Post } from '@nestjs/common';
import { CollectorService } from './collector.service';

@Controller('collector')
export class CollectorController {
  constructor(private readonly collectorService: CollectorService) {}

  @Post('bi-rate')
  collectBiRate() {
    return this.collectorService.collectBiRate();
  }

  @Post('fred')
  collectFred() {
    return this.collectorService.collectFred();
  }

  @Post('idx-price')
  collectIdxPrice() {
    return this.collectorService.collectIdxPrices();
  }
}
