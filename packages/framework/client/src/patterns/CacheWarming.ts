// Generic cache warming strategies
export interface CacheWarmingConfig {
  readonly maxCacheSize: number;
  readonly warmingThreshold: number;
  readonly backgroundWarming: boolean;
  readonly ttl?: number; // Time to live in milliseconds
}

// Default cache warming configuration
export const DEFAULT_CACHE_CONFIG: CacheWarmingConfig = {
  maxCacheSize: 100,
  warmingThreshold: 10,
  backgroundWarming: true,
  ttl: 300000, // 5 minutes
} as const;

// Cache entry with metadata
interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly hits: number;
}

// Generic cache warming handler
export class CacheWarmingHandler<TKey, TValue> {
  private readonly cache = new Map<TKey, CacheEntry<TValue>>();
  private readonly warmingPromises = new Map<TKey, Promise<TValue>>();

  constructor(
    private readonly config: CacheWarmingConfig = DEFAULT_CACHE_CONFIG,
    private readonly keySerializer?: (key: TKey) => string
  ) {}

  // Get from cache or load if needed
  async get(
    key: TKey,
    loader: (key: TKey) => Promise<TValue>
  ): Promise<TValue> {
    const cached = this.cache.get(key);
    
    // Return cached value if valid
    if (cached && !this.isExpired(cached)) {
      // Update hit count
      this.cache.set(key, {
        ...cached,
        hits: cached.hits + 1,
      });
      return cached.value;
    }

    // Check if already loading
    const existingPromise = this.warmingPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Load and cache
    const loadPromise = this.loadAndCache(key, loader);
    this.warmingPromises.set(key, loadPromise);
    
    try {
      const value = await loadPromise;
      return value;
    } finally {
      this.warmingPromises.delete(key);
    }
  }

  // Warm cache for multiple keys
  async warmCache(
    keys: readonly TKey[],
    loader: (key: TKey) => Promise<TValue>,
    options?: {
      readonly force?: boolean;
      readonly background?: boolean;
    }
  ): Promise<void> {
    const { force = false, background = this.config.backgroundWarming } = options ?? {};
    
    const keysToWarm = force 
      ? [...keys]
      : keys.filter(key => !this.cache.has(key) || this.isExpired(this.cache.get(key)!));

    if (keysToWarm.length === 0) {
      return;
    }

    const warmingOperation = async () => {
      const warmingPromises = keysToWarm.map(async (key) => {
        try {
          await this.get(key, loader);
        } catch (error) {
          // Log but don't throw for cache warming failures
          console.debug(`Cache warming failed for key:`, this.serializeKey(key), error);
        }
      });

      await Promise.allSettled(warmingPromises);
    };

    if (background) {
      // Fire and forget
      warmingOperation().catch(error => {
        console.debug('Background cache warming failed:', error);
      });
    } else {
      await warmingOperation();
    }
  }

  // Smart cache warming based on access patterns
  async smartWarm(
    candidates: readonly TKey[],
    loader: (key: TKey) => Promise<TValue>
  ): Promise<void> {
    if (candidates.length <= this.config.warmingThreshold) {
      await this.warmCache(candidates, loader);
      return;
    }

    // Sort by hit count and recency for intelligent warming
    const scoredCandidates = candidates
      .map(key => ({
        key,
        score: this.calculateWarmingScore(key),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.warmingThreshold)
      .map(item => item.key);

    await this.warmCache(scoredCandidates, loader);
  }

  // Batch get with cache warming
  async batchGet(
    keys: readonly TKey[],
    loader: (key: TKey) => Promise<TValue>
  ): Promise<Map<TKey, TValue>> {
    const results = new Map<TKey, TValue>();
    
    // First, try to get from cache
    const uncachedKeys: TKey[] = [];
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached && !this.isExpired(cached)) {
        results.set(key, cached.value);
        // Update hit count
        this.cache.set(key, {
          ...cached,
          hits: cached.hits + 1,
        });
      } else {
        uncachedKeys.push(key);
      }
    }

    // Load uncached keys
    if (uncachedKeys.length > 0) {
      const loadPromises = uncachedKeys.map(async (key) => {
        try {
          const value = await this.get(key, loader);
          results.set(key, value);
        } catch (error) {
          console.debug(`Failed to load key:`, this.serializeKey(key), error);
        }
      });

      await Promise.allSettled(loadPromises);
    }

    return results;
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.warmingPromises.clear();
  }

  // Get cache statistics
  getStats(): {
    readonly size: number;
    readonly hitRate: number;
    readonly warmingInProgress: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalRequests = Math.max(totalHits, 1); // Avoid division by zero
    
    return {
      size: this.cache.size,
      hitRate: totalHits / totalRequests,
      warmingInProgress: this.warmingPromises.size,
    };
  }

  // Private helper methods
  private async loadAndCache(
    key: TKey,
    loader: (key: TKey) => Promise<TValue>
  ): Promise<TValue> {
    const value = await loader(key);
    
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1,
    });
    
    return value;
  }

  private isExpired(entry: CacheEntry<TValue>): boolean {
    if (!this.config.ttl) {
      return false;
    }
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  private calculateWarmingScore(key: TKey): number {
    const cached = this.cache.get(key);
    if (!cached) {
      return 0;
    }
    
    // Score based on hit count and recency
    const recencyScore = Math.max(0, 1 - (Date.now() - cached.timestamp) / (this.config.ttl ?? 300000));
    const hitScore = Math.min(cached.hits / 10, 1); // Normalize hits
    
    return (recencyScore * 0.6) + (hitScore * 0.4);
  }

  private evictOldest(): void {
    if (this.cache.size === 0) return;
    
    let oldestKey: TKey | undefined;
    let oldestTimestamp = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }

  private serializeKey(key: TKey): string {
    if (this.keySerializer) {
      return this.keySerializer(key);
    }
    
    if (typeof key === 'string' || typeof key === 'number') {
      return String(key);
    }
    
    try {
      return JSON.stringify(key);
    } catch {
      return String(key);
    }
  }
}