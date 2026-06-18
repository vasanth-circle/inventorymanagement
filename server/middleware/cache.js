import { getRedis } from '../utils/redisClient.js';

/**
 * Cache middleware for GET routes.
 *
 * Usage in route file:
 *   router.get('/', cacheMiddleware(180, 'items'), getItems);
 *
 * @param {number} ttlSeconds   - How long to cache the response (seconds)
 * @param {string} keyPrefix    - Prefix for the cache key (e.g. 'items', 'customers')
 */
export const cacheMiddleware = (ttlSeconds, keyPrefix) => async (req, res, next) => {
    const redis = getRedis();

    // No Redis → skip cache entirely
    if (!redis) return next();

    // Build a cache key that is unique per tenant + query string
    const tenantId = req.tenantId?.toString() || 'global';
    const queryKey = JSON.stringify(req.query);
    const cacheKey = `${keyPrefix}:${tenantId}:${queryKey}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            // Cache HIT — return immediately
            return res.json(JSON.parse(cached));
        }

        // Cache MISS — intercept res.json to store the result
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redis.setex(cacheKey, ttlSeconds, JSON.stringify(data)).catch(() => {});
            }
            return originalJson(data);
        };

        next();
    } catch (err) {
        // Redis error → just skip cache and proceed normally
        next();
    }
};

/**
 * Invalidate all cache keys matching one or more prefixes for this tenant.
 *
 * Usage in controller after a mutation:
 *   await invalidateCache(req.tenantId, ['items', 'dashboard']);
 *
 * @param {string|ObjectId} tenantId
 * @param {string[]} prefixes    - Array of keyPrefix values to clear
 */
export const invalidateCache = async (tenantId, prefixes) => {
    const redis = getRedis();
    if (!redis) return;

    try {
        const tid = tenantId?.toString() || 'global';
        const deletePromises = prefixes.map(async (prefix) => {
            // Use SCAN to find matching keys (safer than KEYS in production)
            const pattern = `${prefix}:${tid}:*`;
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        });

        await Promise.all(deletePromises);
    } catch (err) {
        // Silent fail — cache invalidation errors should never break mutations
        console.warn('Cache invalidation warning:', err.message);
    }
};
