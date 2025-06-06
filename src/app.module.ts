import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { ConfigModule } from './config/config.module';
import { CacheModule } from './cache/cache.module';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { ReportsService } from './reports/reports.service';
import { TicketsService } from './tickets/tickets.service';

@Module({
  imports: [ConfigModule, CacheModule, DbModule],
  controllers: [TicketsController, ReportsController, HealthcheckController],
  providers: [ReportsService, TicketsService],
})
export class AppModule {}
