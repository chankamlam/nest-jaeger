/**
 * Decorator that sets the cache ttl setting the duration for cache expiration.
 *
 * For example: `@CacheTTL(5)`
 *
 * @param ttl number set the cache expiration time
 *
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 * @publicApi
 */
export declare const CacheTTL: (ttl: number) => import("../../decorators").CustomDecorator<string>;
