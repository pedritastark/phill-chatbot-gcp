class CacheLayer {
    constructor(limit = 1000) {
        this.limit = limit;
        this.cache = new Map();
    }

    get(key) {
        const normalized = this.normalize(key);
        if (this.cache.has(normalized)) {
            // Refresh LRU
            const value = this.cache.get(normalized);
            this.cache.delete(normalized);
            this.cache.set(normalized, value);
            return value;
        }
        return null;
    }

    set(key, value) {
        const normalized = this.normalize(key);
        if (this.cache.has(normalized)) {
            this.cache.delete(normalized);
        } else if (this.cache.size >= this.limit) {
            // Remove oldest (first)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(normalized, value);
    }

    normalize(text) {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }
}

module.exports = CacheLayer;
