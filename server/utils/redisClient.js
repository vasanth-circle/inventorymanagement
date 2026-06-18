import Redis from 'ioredis';

let redisClient = null;
let redisAvailable = false;

/**
 * Initialize Redis connection.
 * Falls back gracefully if Redis is not available — the app continues without caching.
 */
export const initRedis = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = new Redis(redisUrl, {
        // Disable reconnection spam if Redis is not installed
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
            if (times > 3) {
                return null; // Stop retrying after 3 attempts
            }
            return Math.min(times * 200, 1000);
        },
    });

    client.on('connect', () => {
        redisAvailable = true;
        console.log('✅ Redis connected — caching enabled');
    });

    client.on('error', (err) => {
        if (redisAvailable) {
            console.warn('⚠️  Redis error — caching disabled:', err.message);
        }
        redisAvailable = false;
    });

    client.on('close', () => {
        redisAvailable = false;
    });

    // Attempt connection
    client.connect().catch(() => {
        console.warn('⚠️  Redis not available — running without cache (normal if Redis is not installed)');
        redisAvailable = false;
    });

    redisClient = client;
};

/**
 * Returns the Redis client if connected, otherwise null.
 * All callers must handle the null case.
 */
export const getRedis = () => (redisAvailable ? redisClient : null);
