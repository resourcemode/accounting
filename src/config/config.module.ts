import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import reportsConfig from './reports.config';
import cacheConfig from './cache.config';

/**
 * Configuration module for the application
 * Registers all configuration providers
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [reportsConfig, cacheConfig],
      envFilePath: ['.env', '.env.local'],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
