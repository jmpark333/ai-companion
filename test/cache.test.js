// Unit Tests for Cache Module
import { Cache, apiCache, withCache } from '../js/modules/cache.js';

// Simple test framework
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('Running tests...\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`✓ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`✗ ${name}`);
                console.error(`  Error: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }

    assertDeepEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }
}

// Test Suite
const runner = new TestRunner();

// Cache Basic Operations
runner.test('Cache should store and retrieve values', async () => {
    const cache = new Cache({ ttl: 1000 });
    cache.set('test', 'value');
    runner.assertEqual(cache.get('test'), 'value');
});

runner.test('Cache should return null for non-existent keys', async () => {
    const cache = new Cache();
    runner.assertEqual(cache.get('nonexistent'), null);
});

runner.test('Cache should respect TTL', async () => {
    const cache = new Cache({ ttl: 50 });
    cache.set('test', 'value');
    runner.assertEqual(cache.get('test'), 'value');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 60));
    runner.assertEqual(cache.get('test'), null);
});

runner.test('Cache should limit size', async () => {
    const cache = new Cache({ maxSize: 2 });
    cache.set('1', 'value1');
    cache.set('2', 'value2');
    cache.set('3', 'value3');

    runner.assertEqual(cache.get('1'), null); // Should be evicted
    runner.assertEqual(cache.get('2'), 'value2');
    runner.assertEqual(cache.get('3'), 'value3');
});

runner.test('Cache should delete values', async () => {
    const cache = new Cache();
    cache.set('test', 'value');
    cache.delete('test');
    runner.assertEqual(cache.get('test'), null);
});

runner.test('Cache should clear all values', async () => {
    const cache = new Cache();
    cache.set('1', 'value1');
    cache.set('2', 'value2');
    cache.clear();
    runner.assertEqual(cache.get('1'), null);
    runner.assertEqual(cache.get('2'), null);
    runner.assertEqual(cache.size(), 0);
});

// Complex Key Generation
runner.test('Cache should create complex keys correctly', async () => {
    const cache = new Cache();
    const key1 = cache._createKey('prefix', 'arg1', 'arg2');
    const key2 = cache._createKey('prefix', ['arg1', 'arg2']);
    const key3 = cache._createKey('prefix', { a: 1, b: 2 });

    runner.assert(key1.includes('prefix'));
    runner.assert(key2.includes('prefix'));
    runner.assert(key3.includes('prefix'));
    runner.assertNotEqual(key1, key2);
});

runner.test('Cache should handle expiration cleanup', async () => {
    const cache = new Cache({ ttl: 50 });
    cache.set('1', 'value1');
    cache.set('2', 'value2');

    await new Promise(resolve => setTimeout(resolve, 60));
    cache.cleanup(); // Manual cleanup

    runner.assertEqual(cache.get('1'), null);
    runner.assertEqual(cache.get('2'), null);
});

// withCache decorator
runner.test('withCache should cache function results', async () => {
    let callCount = 0;
    const fn = async (x) => {
        callCount++;
        return x * 2;
    };

    const cachedFn = withCache('test', fn);

    // First call
    const result1 = await cachedFn(5);
    runner.assertEqual(result1, 10);
    runner.assertEqual(callCount, 1);

    // Second call (should use cache)
    const result2 = await cachedFn(5);
    runner.assertEqual(result2, 10);
    runner.assertEqual(callCount, 1); // Still called only once
});

runner.test('withCache should not cache errors', async () => {
    let callCount = 0;
    const fn = async () => {
        callCount++;
        throw new Error('Test error');
    };

    const cachedFn = withCache('test', fn);

    try {
        await cachedFn();
        runner.assert(false, 'Should have thrown error');
    } catch (error) {
        runner.assertEqual(error.message, 'Test error');
        runner.assertEqual(callCount, 1);
    }

    // Second call should also fail and not use cache
    try {
        await cachedFn();
        runner.assert(false, 'Should have thrown error');
    } catch (error) {
        runner.assertEqual(callCount, 2); // Called again
    }
});

// API Cache specific tests
runner.test('apiCache should have correct default config', async () => {
    runner.assertEqual(apiCache.maxSize, 100);
    runner.assertEqual(apiCache.ttl, 5 * 60 * 1000); // 5 minutes
});

runner.test('apiCache should handle complex data structures', async () => {
    const data = {
        messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ],
        usage: { total_tokens: 100 }
    };

    apiCache.set('complex', data);
    const retrieved = apiCache.get('complex');
    runner.assertDeepEqual(retrieved, data);
});

runner.test('Cache should work with different data types', async () => {
    const cache = new Cache();

    // String
    cache.set('str', 'string value');
    runner.assertEqual(cache.get('str'), 'string value');

    // Number
    cache.set('num', 42);
    runner.assertEqual(cache.get('num'), 42);

    // Boolean
    cache.set('bool', true);
    runner.assertEqual(cache.get('bool'), true);

    // Array
    cache.set('arr', [1, 2, 3]);
    runner.assertDeepEqual(cache.get('arr'), [1, 2, 3]);

    // Object
    cache.set('obj', { a: 1, b: 2 });
    runner.assertDeepEqual(cache.get('obj'), { a: 1, b: 2 });

    // Null
    cache.set('null', null);
    runner.assertEqual(cache.get('null'), null);
});

// Performance test
runner.test('Cache should handle many operations efficiently', async () => {
    const cache = new Cache({ maxSize: 1000 });
    const start = performance.now();

    // Add 1000 items
    for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`);
    }

    // Retrieve 1000 items
    for (let i = 0; i < 1000; i++) {
        cache.get(`key${i}`);
    }

    const end = performance.now();
    const duration = end - start;

    // Should complete within reasonable time (100ms)
    runner.assert(duration < 100, `Operations took ${duration}ms, expected < 100ms`);
    console.log(`  Performance: ${duration.toFixed(2)}ms for 2000 operations`);
});

// Edge cases
runner.test('Cache should handle empty strings as keys', async () => {
    const cache = new Cache();
    cache.set('', 'empty key value');
    runner.assertEqual(cache.get(''), 'empty key value');
});

runner.test('Cache should handle special characters in keys', async () => {
    const cache = new Cache();
    const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    cache.set(specialKey, 'special value');
    runner.assertEqual(cache.get(specialKey), 'special value');
});

runner.test('Cache should handle undefined values', async () => {
    const cache = new Cache();
    cache.set('undefined', undefined);
    runner.assertEqual(cache.get('undefined'), undefined);
});

// Export for running in browser or Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runner, TestRunner };
} else {
    // Browser environment - run tests automatically
    window.addEventListener('DOMContentLoaded', async () => {
        const success = await runner.run();
        if (success) {
            console.log('\n✅ All tests passed!');
        } else {
            console.log('\n❌ Some tests failed!');
        }
    });
}