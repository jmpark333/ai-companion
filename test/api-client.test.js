// Unit Tests for API Client Module
import { ZAIAPIClient } from '../js/modules/api-client.js';

// Mock fetch for testing
global.fetch = async (url, options) => {
    const mockResponse = {
        ok: true,
        json: async () => ({
            choices: [
                {
                    message: {
                        content: 'Mock response'
                    }
                }
            ],
            usage: {
                total_tokens: 50
            }
        })
    };
    return mockResponse;
};

// Mock AbortSignal
global.AbortSignal = {
    timeout: (ms) => ({
        addEventListener: () => {},
        removeEventListener: () => {}
    })
};

// Mock crypto
global.crypto = {
    subtle: {
        importKey: async () => ({ name: 'HMAC' }),
        sign: async () => new Uint8Array([1, 2, 3, 4])
    }
};

// Test Framework (simplified version)
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
        console.log('Running API Client Tests...\n');

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

const runner = new TestRunner();

// API Client Initialization Tests
runner.test('ZAIAPIClient should initialize with default values', async () => {
    const client = new ZAIAPIClient();
    runner.assertEqual(client.baseURL, "https://api.z.ai/api/paas/v4/");
    runner.assertEqual(client.authMethod, "apikey");
    runner.assertEqual(client.requestTimeout, 30000);
    runner.assertEqual(client.maxRetries, 3);
    runner.assert(client.usageStats.totalRequests === 0);
});

runner.test('ZAIAPIClient should track usage stats', async () => {
    const client = new ZAIAPIClient();
    client.usageStats.totalRequests = 10;
    client.usageStats.successfulRequests = 8;
    client.usageStats.failedRequests = 2;

    const stats = client.getUsageStats();
    runner.assertEqual(stats.totalRequests, 10);
    runner.assertEqual(stats.successfulRequests, 8);
    runner.assertEqual(stats.failedRequests, 2);
});

runner.test('ZAIAPIClient should reset usage stats', async () => {
    const client = new ZAIAPIClient();
    client.usageStats.totalRequests = 10;
    client.resetUsageStats();

    const stats = client.getUsageStats();
    runner.assertEqual(stats.totalRequests, 0);
    runner.assertEqual(stats.successfulRequests, 0);
    runner.assertEqual(stats.failedRequests, 0);
});

// JWT Token Tests
runner.test('generateJWTToken should create valid token format', async () => {
    const client = new ZAIAPIClient();

    // Mock API key
    const apiKey = "test-id.test-secret";
    await client.setAuthMethod("jwt", apiKey);

    runner.assert(client.jwtToken !== null);
    runner.assert(client.jwtToken.includes('.'));

    const parts = client.jwtToken.split('.');
    runner.assertEqual(parts.length, 3);
});

runner.test('generateJWTToken should handle invalid API key', async () => {
    const client = new ZAIAPIClient();

    try {
        await client.setAuthMethod("jwt", "invalid-api-key");
        runner.assert(false, 'Should have thrown error');
    } catch (error) {
        runner.assert(error.message.includes('잘못된 API 키 형식'));
    }
});

runner.test('generateHMACSHA256 should create signature', async () => {
    const client = new ZAIAPIClient();

    const signature = await client.generateHMACSHA256("test message", "test secret");
    runner.assert(signature !== null);
    runner.assert(typeof signature === 'string');
    runner.assert(signature.length > 0);
});

// Header Generation Tests
runner.test('getHeaders should include authorization for apikey method', async () => {
    const client = new ZAIAPIClient();
    await client.setAuthMethod("apikey", "test-api-key");

    const headers = client.getHeaders();
    runner.assertEqual(headers["Authorization"], "Bearer test-api-key");
    runner.assertEqual(headers["Content-Type"], "application/json");
});

runner.test('getHeaders should include authorization for jwt method', async () => {
    const client = new ZAIAPIClient();

    // Mock JWT token
    client.authMethod = "jwt";
    client.jwtToken = "test.jwt.token";

    const headers = client.getHeaders();
    runner.assertEqual(headers["Authorization"], "Bearer test.jwt.token");
});

// Request Tests
runner.test('makeRequest should call fetch with correct parameters', async () => {
    const client = new ZAIAPIClient();
    client.apiKey = "test-key";
    client.authMethod = "apikey";

    const response = await client.makeRequest("test/endpoint", { test: "data" });

    runner.assert(response !== null);
    runner.assert(response.choices !== undefined);
});

runner.test('chat should format message correctly', async () => {
    const client = new ZAIAPIClient();
    client.apiKey = "test-key";
    client.authMethod = "apikey";

    const messages = [
        { role: "user", content: "Hello" }
    ];

    const response = await client.chat(messages);

    runner.assert(response !== null);
    runner.assert(response.choices.length > 0);
    runner.assertEqual(response.choices[0].message.content, "Mock response");
});

// Error Handling Tests
runner.test('makeRequest should handle network errors', async () => {
    // Mock fetch to fail
    global.fetch = async () => {
        throw new Error('Network error');
    };

    const client = new ZAIAPIClient();
    client.maxRetries = 1;
    client.retryDelay = 10; // Shorten delay for testing

    try {
        await client.makeRequest("test", {});
        runner.assert(false, 'Should have thrown error');
    } catch (error) {
        runner.assert(error.message.includes('API 요청 실패'));
    }

    // Restore mock
    global.fetch = async (url, options) => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Mock' } }] })
    });
});

runner.test('makeRequest should handle HTTP errors', async () => {
    // Mock fetch to return HTTP error
    global.fetch = async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found'
    });

    const client = new ZAIAPIClient();
    client.maxRetries = 1;
    client.retryDelay = 10;

    try {
        await client.makeRequest("test", {});
        runner.assert(false, 'Should have thrown error');
    } catch (error) {
        runner.assert(error.message.includes('HTTP 오류'));
    }

    // Restore mock
    global.fetch = async (url, options) => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Mock' } }] })
    });
});

// Auth Method Tests
runner.test('setAuthMethod should update auth method', async () => {
    const client = new ZAIAPIClient();

    await client.setAuthMethod("jwt", "test-id.test-secret");
    runner.assertEqual(client.authMethod, "jwt");
    runner.assertEqual(client.apiKey, "test-id.test-secret");
});

runner.test('ensureValidToken should refresh expired token', async () => {
    const client = new ZAIAPIClient();
    client.authMethod = "jwt";
    client.apiKey = "test-id.test-secret";
    client.jwtToken = "old.token";
    client.tokenExpiry = Date.now() - 1000; // Expired

    await client.ensureValidToken();

    runner.assertNotEqual(client.jwtToken, "old.token");
    runner.assert(client.tokenExpiry > Date.now());
});

// Statistics Tests
runner.test('API calls should update usage stats correctly', async () => {
    const client = new ZAIAPIClient();
    client.apiKey = "test-key";
    client.authMethod = "apikey";

    const initialStats = client.getUsageStats();
    await client.chat([{ role: "user", content: "test" }]);

    const newStats = client.getUsageStats();
    runner.assertEqual(newStats.totalRequests, initialStats.totalRequests + 1);
    runner.assertEqual(newStats.successfulRequests, initialStats.successfulRequests + 1);
    runner.assertEqual(newStats.totalTokens, initialStats.totalTokens + 50);
});

// Configuration Tests
runner.test('client should use custom configuration', async () => {
    const client = new ZAIAPIClient();
    client.requestTimeout = 5000;
    client.maxRetries = 5;
    client.retryDelay = 2000;

    runner.assertEqual(client.requestTimeout, 5000);
    runner.assertEqual(client.maxRetries, 5);
    runner.assertEqual(client.retryDelay, 2000);
});

// Export for running
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runner, TestRunner };
} else {
    window.addEventListener('DOMContentLoaded', async () => {
        const success = await runner.run();
        if (success) {
            console.log('\n✅ All API client tests passed!');
        } else {
            console.log('\n❌ Some API client tests failed!');
        }
    });
}