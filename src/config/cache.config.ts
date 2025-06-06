import { registerAs } from '@nestjs/config';

/**
 * Cache module configuration
 */
export interface CacheConfig {
  /**
   * Redis host
   */
  host: string;
  
  /**
   * Redis port
   */
  port: number;
  
  /**
   * TTL in seconds
   */
  ttl: number;
}

export default registerAs('cache', (): CacheConfig => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380', 10), // Using port 6380 to avoid conflicts
  ttl: parseInt(process.env.REDIS_TTL || '3600', 10) // Default 1 hour TTL
}));
