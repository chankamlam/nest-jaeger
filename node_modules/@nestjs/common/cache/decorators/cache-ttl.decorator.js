"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = void 0;
const decorators_1 = require("../../decorators");
const cache_constants_1 = require("../cache.constants");
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
exports.CacheTTL = (ttl) => decorators_1.SetMetadata(cache_constants_1.CACHE_TTL_METADATA, ttl);
