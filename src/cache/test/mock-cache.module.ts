import { Module } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

/**
 * Mock cache service used for testing
 * This provides a simple in-memory cache implementation
 * that doesn't require a Redis server to run
 */
const cache = new Map<string, any>();

const mockCacheService = {
  get: jest.fn((key: string) => Promise.resolve(cache.get(key))),
  set: jest.fn((key: string, value: any) => {
    cache.set(key, value);
    return Promise.resolve(true);
  }),
  del: jest.fn((key: string) => {
    cache.delete(key);
    return Promise.resolve(true);
  }),
  reset: jest.fn(() => {
    cache.clear();
    return Promise.resolve(true);
  }),
  wrap: jest.fn(async (key: string, factory: () => any) => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    const value = await factory();
    cache.set(key, value);
    return value;
  }),
  store: {
    keys: jest.fn(() => Promise.resolve(Array.from(cache.keys()))),
  },
};

/**
 * Mock cache module for testing
 * This provides a simple in-memory cache service that doesn't require Redis
 */
@Module({
  providers: [
    {
      provide: CACHE_MANAGER,
      useValue: mockCacheService,
    },
  ],
  exports: [CACHE_MANAGER],
})
export class MockCacheModule {}
