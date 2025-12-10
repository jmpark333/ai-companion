// Unit Tests for UI Manager Module
import { UIManager } from '../js/modules/ui-manager.js';

// Mock DOM for testing
class MockElement {
    constructor(tagName, id = null) {
        this.tagName = tagName;
        this.id = id;
        this.className = '';
        this.textContent = '';
        this.children = [];
        this.classList = {
            add: (cls) => {
                if (!this.className.includes(cls)) {
                    this.className += ' ' + cls;
                }
            },
            remove: (cls) => {
                this.className = this.className.replace(new RegExp(`\\b${cls}\\b`, 'g'), '');
            },
            contains: (cls) => this.className.includes(cls)
        };
        this.style = {};
        this.addEventListener = () => {};
        this.removeEventListener = () => {};
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            return this.children.find(el => el.id === selector.substring(1));
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector.startsWith('.')) {
            return this.children.filter(el => el.classList.contains(selector.substring(1)));
        }
        return [];
    }

    appendChild(child) {
        this.children.push(child);
    }

    addEventListener() {}
    removeEventListener() {}
}

// Mock document
global.document = {
    createElement: (tagName) => new MockElement(tagName),
    querySelector: (selector) => {
        const elements = {
            '#chatInput': new MockElement('textarea', 'chatInput'),
            '#sendButton': new MockElement('button', 'sendButton'),
            '#chatMessages': new MockElement('div', 'chatMessages'),
            '#themeToggle': new MockElement('button', 'themeToggle'),
            '.loading-indicator': new MockElement('div', 'loading-indicator')
        };
        return elements[selector] || null;
    },
    body: new MockElement('body'),
    addEventListener: () => {}
};

global.localStorage = {
    setItem: () => {},
    getItem: () => null
};

// Test Framework
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
        console.log('Running UI Manager Tests...\n');

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
}

const runner = new TestRunner();

// UI Manager Initialization Tests
runner.test('UIManager should initialize correctly', async () => {
    const ui = new UIManager();
    runner.assert(ui.elements instanceof Map);
    runner.assert(ui.eventListeners instanceof Map);
    runner.assertEqual(ui.elements.size, 0);
});

runner.test('UIManager should cache elements on init', async () => {
    const ui = new UIManager();
    ui.init();

    runner.assert(ui.elements.size > 0);
    runner.assert(ui.get('chatInput') !== null);
    runner.assert(ui.get('sendButton') !== null);
});

runner.test('UIManager should return cached elements', async () => {
    const ui = new UIManager();
    ui.init();

    const chatInput = ui.get('chatInput');
    const sameChatInput = ui.get('chatInput');
    runner.assertEqual(chatInput, sameChatInput);
});

runner.test('UIManager should return null for missing elements', async () => {
    const ui = new UIManager();
    runner.assertEqual(ui.get('nonexistent'), null);
});

// Event Listener Tests
runner.test('UIManager should add event listeners', async () => {
    const ui = new UIManager();
    ui.init();

    const element = ui.get('sendButton');
    const handler = () => {};
    ui.addListener(element, 'click', handler);

    runner.assert(ui.eventListeners.has('sendButton:click'));
});

runner.test('UIManager should replace existing listeners', async () => {
    const ui = new UIManager();
    ui.init();

    const element = ui.get('sendButton');
    const handler1 = () => {};
    const handler2 = () => {};

    ui.addListener(element, 'click', handler1);
    const key1 = Array.from(ui.eventListeners.keys()).find(k => k.includes('sendButton:click'));
    const listener1 = ui.eventListeners.get(key1);

    ui.addListener(element, 'click', handler2);
    const key2 = Array.from(ui.eventListeners.keys()).find(k => k.includes('sendButton:click'));
    const listener2 = ui.eventListeners.get(key2);

    runner.assertNotEqual(listener1.handler, handler2);
    runner.assertEqual(listener2.handler, handler2);
});

// Custom Event System Tests
runner.test('UIManager should support custom events', async () => {
    const ui = new UIManager();
    let eventFired = false;
    let eventData = null;

    ui.on('test:event', (data) => {
        eventFired = true;
        eventData = data;
    });

    ui.emit('test:event', { test: 'data' });

    runner.assert(eventFired);
    runner.assertEqual(eventData.test, 'data');
});

runner.test('UIManager should support multiple listeners for same event', async () => {
    const ui = new UIManager();
    let count = 0;

    ui.on('test:event', () => count++);
    ui.on('test:event', () => count++);

    ui.emit('test:event', {});

    runner.assertEqual(count, 2);
});

// Loading Indicator Tests
runner.test('UIManager should show loading indicator', async () => {
    const ui = new UIManager();
    ui.init();

    const indicator = ui.get('loading-indicator');
    ui.showLoading('Test message');

    runner.assertEqual(indicator.style.display, 'block');
    runner.assertEqual(indicator.textContent, 'Test message');
});

runner.test('UIManager should hide loading indicator', async () => {
    const ui = new UIManager();
    ui.init();

    const indicator = ui.get('loading-indicator');
    ui.showLoading('Test');
    ui.hideLoading();

    runner.assertEqual(indicator.style.display, 'none');
});

// Modal Tests
runner.test('UIManager should show modals', async () => {
    const ui = new UIManager();

    // Mock modal element
    const modal = new MockElement('div', 'testModal');
    global.document.getElementById = (id) => {
        if (id === 'testModal') return modal;
        return null;
    };

    ui.showModal('testModal');
    runner.assert(modal.classList.contains('active'));
    runner.assert(modal.classList.contains('with-backdrop'));
});

runner.test('UIManager should hide modals', async () => {
    const ui = new UIManager();

    // Mock modal element
    const modal = new MockElement('div', 'testModal');
    modal.classList.add('active', 'with-backdrop');

    global.document.getElementById = (id) => {
        if (id === 'testModal') return modal;
        return null;
    };

    ui.hideModal('testModal');
    runner.assert(!modal.classList.contains('active'));
    runner.assert(!modal.classList.contains('with-backdrop'));
});

// Theme Tests
runner.test('UIManager should toggle theme', async () => {
    const ui = new UIManager();

    // Mock body element
    global.document.body = new MockElement('body');
    global.localStorage.setItem = (key, value) => {
        if (key === 'theme') {
            ui.lastThemeValue = value;
        }
    };

    ui.toggleTheme();
    runner.assert(global.document.body.classList.contains('dark-theme'));
    runner.assertEqual(ui.lastThemeValue, 'dark');
});

runner.test('UIManager should load saved theme', async () => {
    const ui = new UIManager();

    // Mock body element
    global.document.body = new MockElement('body');
    global.localStorage.getItem = (key) => {
        if (key === 'theme') return 'dark';
        return null;
    };

    ui.loadTheme();
    runner.assert(global.document.body.classList.contains('dark-theme'));
});

// Message Tests
runner.test('UIManager should add messages to chat', async () => {
    const ui = new UIManager();
    ui.init();

    const messagesContainer = ui.get('chatMessages');
    ui.addMessage('user', 'Test message');

    runner.assert(messagesContainer.children.length > 0);
    const messageEl = messagesContainer.children[0];
    runner.assert(messageEl.classList.contains('user-message'));
    runner.assert(messageEl.textContent.includes('Test message'));
});

runner.test('UIManager should format messages correctly', async () => {
    const ui = new UIManager();

    const tests = [
        { input: '**bold**', expected: '<strong>bold</strong>' },
        { input: '*italic*', expected: '<em>italic</em>' },
        { input: '`code`', expected: '<code>code</code>' },
        { input: 'line1\nline2', expected: 'line1<br>line2' }
    ];

    for (const { input, expected } of tests) {
        const result = ui.formatMessage(input);
        runner.assert(result.includes(expected), `Failed to format: ${input}`);
    }
});

// Cleanup Tests
runner.test('UIManager should cleanup properly', async () => {
    const ui = new UIManager();
    ui.init();

    // Add some listeners
    ui.addListener('sendButton', 'click', () => {});
    ui.on('test:event', () => {});

    ui.cleanup();

    runner.assertEqual(ui.elements.size, 0);
    runner.assertEqual(ui.eventListeners.size, 0);
});

// Error Handling Tests
runner.test('UIManager should handle missing DOM elements gracefully', async () => {
    const ui = new UIManager();

    // Should not throw error
    ui.showModal('nonexistent');
    ui.hideModal('nonexistent');

    const element = ui.get('nonexistent');
    runner.assertEqual(element, null);
});

// Performance Tests
runner.test('UIManager should handle many operations efficiently', async () => {
    const ui = new UIManager();
    const start = performance.now();

    // Add many elements to cache
    for (let i = 0; i < 1000; i++) {
        ui.elements.set(`test${i}`, { id: i });
    }

    // Retrieve many elements
    for (let i = 0; i < 1000; i++) {
        ui.get(`test${i}`);
    }

    const end = performance.now();
    const duration = end - start;

    runner.assert(duration < 50, `Operations took ${duration}ms, expected < 50ms`);
    console.log(`  Performance: ${duration.toFixed(2)}ms for 2000 operations`);
});

// Export for running
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runner, TestRunner };
} else {
    window.addEventListener('DOMContentLoaded', async () => {
        const success = await runner.run();
        if (success) {
            console.log('\n✅ All UI manager tests passed!');
        } else {
            console.log('\n❌ Some UI manager tests failed!');
        }
    });
}