import fetchMock from 'fetch-mock-jest';
import SpectraView from '../src/spectraview';

describe('SpectraView SDK', () => {
  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Reset SpectraView state
    if (SpectraView.isRecording) {
      SpectraView.stop();
    }
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize with valid config', async () => {
      const config = {
        apiKey: 'test-key',
        apiBaseUrl: 'http://localhost:3001',
        appId: 'test-app',
        userId: 'test-user',
        debug: true
      };

      fetchMock.post('http://localhost:3001/api/sessions/start', {
        success: true,
        sessionId: 'test-session-id'
      });

      await SpectraView.init(config);

      expect(SpectraView.isRecording).toBe(true);
      expect(SpectraView.config.apiKey).toBe('test-key');
      expect(SpectraView.config.appId).toBe('test-app');
      expect(SpectraView.userId).toBe('test-user');
      expect(fetchMock.called('http://localhost:3001/api/sessions/start')).toBe(true);
    });

    test('should work in offline mode without API endpoint', async () => {
      const config = {
        apiKey: 'demo-key',
        apiBaseUrl: null,
        appId: 'demo-app'
      };

      await SpectraView.init(config);

      expect(SpectraView.isRecording).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No API endpoint or base URL provided')
      );
    });

    test('should not initialize twice if already recording', async () => {
      const config = {
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      };

      await SpectraView.init(config);
      const firstSessionId = SpectraView.sessionId;

      await SpectraView.init(config);
      
      expect(SpectraView.sessionId).toBe(firstSessionId);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[SpectraView] Already recording');
    });

    test('should use environment variables when config not provided', async () => {
      // Mock process.env
      process.env.SPECTRAVIEW_API_KEY = 'env-api-key';
      process.env.SPECTRAVIEW_BASE_URL = 'http://env-api.com';
      process.env.SPECTRAVIEW_APP_ID = 'env-app';

      await SpectraView.init({});

      expect(SpectraView.config.apiKey).toBe('env-api-key');
      expect(SpectraView.config.apiBaseUrl).toBe('http://env-api.com');
      expect(SpectraView.config.appId).toBe('env-app');

      // Clean up
      delete process.env.SPECTRAVIEW_API_KEY;
      delete process.env.SPECTRAVIEW_BASE_URL;
      delete process.env.SPECTRAVIEW_APP_ID;
    });
  });

  describe('Event Capture', () => {
    beforeEach(async () => {
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null, // Offline mode
        appId: 'test-app',
        debug: false
      });
    });

    test('should capture custom events', () => {
      const eventData = {
        action: 'button_click',
        value: 'submit'
      };

      SpectraView.capture('test_event', eventData);

      expect(SpectraView.customEventBuffer).toHaveLength(1);
      expect(SpectraView.customEventBuffer[0]).toMatchObject({
        type: 'custom',
        eventType: 'test_event',
        data: eventData
      });
    });

    test('should capture click events', () => {
      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Click me';
      document.body.appendChild(button);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        pageX: 100,
        pageY: 200
      });

      button.dispatchEvent(event);

      expect(SpectraView.performanceData.clickCount).toBe(1);
      expect(SpectraView.customEventBuffer).toHaveLength(1);
      expect(SpectraView.customEventBuffer[0].eventType).toBe('click');

      document.body.removeChild(button);
    });

    test('should capture error events', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error')
      });

      window.dispatchEvent(errorEvent);

      expect(SpectraView.performanceData.errorCount).toBe(1);
      expect(SpectraView.errorBuffer).toHaveLength(1);
      expect(SpectraView.errorBuffer[0]).toMatchObject({
        type: 'javascript_error',
        message: 'Test error',
        filename: 'test.js'
      });
    });

    test('should capture navigation events', () => {
      const originalPushState = history.pushState;
      
      // Navigate using pushState
      history.pushState({}, '', '/new-page');

      expect(SpectraView.customEventBuffer.length).toBeGreaterThan(0);
      const navEvent = SpectraView.customEventBuffer.find(e => 
        e.eventType === 'navigation' && e.data.type === 'pushState'
      );
      
      expect(navEvent).toBeDefined();
      expect(navEvent.data.url).toBe('/new-page');

      // Restore original pushState
      history.pushState = originalPushState;
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      });
    });

    test('should export events correctly', () => {
      // Add some test events
      SpectraView.eventBuffer.push({
        type: 2,
        data: { test: 'snapshot' },
        timestamp: Date.now()
      });

      SpectraView.customEventBuffer.push({
        type: 'custom',
        eventType: 'test',
        data: { value: 123 }
      });

      const exported = SpectraView.exportEvents();

      expect(exported.events).toHaveLength(1);
      expect(exported.metadata.eventCount).toBe(1);
      expect(exported.metadata.customEvents).toHaveLength(1);
      expect(exported.metadata.sessionId).toBeDefined();
      expect(exported.metadata.appId).toBe('test-app');
    });

    test('should get replay events', () => {
      const testEvent = {
        type: 2,
        data: { test: 'data' },
        timestamp: Date.now()
      };

      SpectraView.eventBuffer.push(testEvent);

      const replayEvents = SpectraView.getReplayEvents();

      expect(replayEvents).toHaveLength(1);
      expect(replayEvents[0]).toEqual(testEvent);
    });

    test('should download events as JSON file', () => {
      // Mock DOM methods
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');
      
      // Mock click
      HTMLAnchorElement.prototype.click = jest.fn();

      SpectraView.eventBuffer.push({
        type: 2,
        data: { test: 'data' },
        timestamp: Date.now()
      });

      SpectraView.downloadEvents();

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      // Clean up
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('API Communication', () => {
    beforeEach(() => {
      fetchMock.reset();
    });

    test('should send session start when API endpoint is configured', async () => {
      fetchMock.post('http://api.test.com/api/sessions/start', {
        success: true,
        sessionId: 'test-session'
      });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app'
      });

      expect(fetchMock.called('http://api.test.com/api/sessions/start')).toBe(true);
      
      const lastCall = fetchMock.lastCall('http://api.test.com/api/sessions/start');
      const body = JSON.parse(lastCall[1].body);
      
      expect(body).toMatchObject({
        sessionId: expect.any(String),
        appId: 'test-app',
        startTime: expect.any(Number)
      });
    });

    test('should batch and send events', async () => {
      fetchMock.post('http://api.test.com/api/sessions/start', { success: true });
      fetchMock.post(/.*\/events$/, { success: true });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app',
        batchSize: 2
      });

      // Add events to trigger batch
      SpectraView.handleRRWebEvent({ type: 2, data: {}, timestamp: Date.now() });
      SpectraView.handleRRWebEvent({ type: 3, data: {}, timestamp: Date.now() });

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventsCalls = fetchMock.calls().filter(call => 
        call[0].includes('/events')
      );
      
      expect(eventsCalls.length).toBeGreaterThan(0);
    });

    test('should send heartbeat', async () => {
      fetchMock.post('http://api.test.com/api/sessions/start', { success: true });
      fetchMock.post(/.*\/heartbeat$/, { success: true });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app'
      });

      // Manually trigger heartbeat
      await SpectraView.sendHeartbeat();

      expect(fetchMock.called(/.*\/heartbeat$/)).toBe(true);
    });

    test('should send session end on stop', async () => {
      fetchMock.post('http://api.test.com/api/sessions/start', { success: true });
      fetchMock.post(/.*\/end$/, { success: true });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app'
      });

      SpectraView.stop();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetchMock.called(/.*\/end$/)).toBe(true);
    });
  });

  describe('Privacy and Sanitization', () => {
    beforeEach(async () => {
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      });
    });

    test('should sanitize sensitive data', () => {
      const data = {
        email: 'test@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
        card: '4111 1111 1111 1111',
        safe: 'This is safe text'
      };

      const sanitized = SpectraView.sanitizeData(data);

      expect(sanitized.email).toBe('[EMAIL]');
      expect(sanitized.phone).toBe('[PHONE]');
      expect(sanitized.ssn).toBe('[SSN]');
      expect(sanitized.card).toBe('[CARD]');
      expect(sanitized.safe).toBe('This is safe text');
    });

    test('should respect privacy configuration', async () => {
      SpectraView.stop();
      
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app',
        maskAllInputs: true,
        blockClass: 'block-me',
        ignoreClass: 'ignore-me'
      });

      expect(SpectraView.config.maskAllInputs).toBe(true);
      expect(SpectraView.config.blockClass).toBe('block-me');
      expect(SpectraView.config.ignoreClass).toBe('ignore-me');
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      });
    });

    test('should set user ID and metadata', () => {
      const metadata = {
        name: 'John Doe',
        plan: 'premium'
      };

      SpectraView.setUser('user-123', metadata);

      expect(SpectraView.userId).toBe('user-123');
      expect(SpectraView.customEventBuffer).toHaveLength(1);
      expect(SpectraView.customEventBuffer[0]).toMatchObject({
        eventType: 'identify',
        data: {
          userId: 'user-123',
          metadata
        }
      });
    });

    test('should add context to session', () => {
      const context = {
        feature: 'checkout',
        version: '1.2.3'
      };

      SpectraView.addContext(context);

      expect(SpectraView.sessionMetadata).toMatchObject(context);
      expect(SpectraView.customEventBuffer).toHaveLength(1);
      expect(SpectraView.customEventBuffer[0]).toMatchObject({
        eventType: 'context',
        data: context
      });
    });
  });

  describe('Performance', () => {
    test('should track performance metrics', async () => {
      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      });

      const startTime = SpectraView.performanceData.startTime;
      expect(startTime).toBeDefined();
      expect(startTime).toBeLessThanOrEqual(Date.now());

      // Simulate some events
      SpectraView.handleRRWebEvent({ type: 2, data: {}, timestamp: Date.now() });
      SpectraView.capture('test', {});
      
      expect(SpectraView.performanceData.eventCount).toBe(1);
    });

    test('should compress events when configured', () => {
      const events = [
        { type: 2, data: { large: 'x'.repeat(1000) }, timestamp: Date.now() },
        { type: 3, data: { large: 'y'.repeat(1000) }, timestamp: Date.now() }
      ];

      const compressed = SpectraView.compressEvents(events);

      expect(compressed.compressed).toBe(true);
      expect(compressed.data).toBeDefined();
      expect(typeof compressed.data).toBe('string'); // Base64 string
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch errors gracefully', async () => {
      fetchMock.post('http://api.test.com/api/sessions/start', 500);

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app',
        debug: true
      });

      // Should still be recording even if API fails
      expect(SpectraView.isRecording).toBe(true);
    });

    test('should handle invalid configuration', async () => {
      await SpectraView.init({}); // Empty config

      // Should work in offline mode
      expect(SpectraView.isRecording).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test('should handle storage errors', async () => {
      // Mock localStorage to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage full');
      });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app',
        enableLocalStorage: true
      });

      // Should not throw, just fail silently
      SpectraView.saveEventLocal({ test: 'data' });

      expect(SpectraView.isRecording).toBe(true);

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Cleanup', () => {
    test('should stop recording and clean up', async () => {
      fetchMock.post(/.*/, { success: true });

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: 'http://api.test.com',
        appId: 'test-app'
      });

      expect(SpectraView.isRecording).toBe(true);

      SpectraView.stop();

      expect(SpectraView.isRecording).toBe(false);
      expect(SpectraView.stopRecordingFn).toBe(null);
      expect(SpectraView.batchTimer).toBe(null);
      expect(SpectraView.heartbeatTimer).toBe(null);
    });

    test('should clear timers on stop', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await SpectraView.init({
        apiKey: 'test-key',
        apiBaseUrl: null,
        appId: 'test-app'
      });

      const batchTimer = SpectraView.batchTimer;
      const heartbeatTimer = SpectraView.heartbeatTimer;

      SpectraView.stop();

      expect(clearIntervalSpy).toHaveBeenCalledWith(batchTimer);
      expect(clearIntervalSpy).toHaveBeenCalledWith(heartbeatTimer);

      clearIntervalSpy.mockRestore();
    });
  });
});