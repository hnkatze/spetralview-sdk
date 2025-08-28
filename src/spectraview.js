/**
 * SpectraView SDK - Session Recording and Event Capture
 * @version 1.0.0
 */

import * as rrweb from 'rrweb';
import { pack } from 'rrweb';
import pako from 'pako';
import { v4 as uuidv4 } from 'uuid';
import localforage from 'localforage';

class SpectraViewSDK {
  constructor() {
    // Configuration
    this.config = null;
    this.sessionId = null;
    this.userId = null;
    
    // State
    this.isRecording = false;
    this.stopRecordingFn = null;
    
    // Event buffers
    this.eventBuffer = [];
    this.customEventBuffer = [];
    this.errorBuffer = [];
    
    // Timers
    this.batchTimer = null;
    this.heartbeatTimer = null;
    
    // Storage
    this.storage = null;
    
    // Metadata
    this.sessionMetadata = {};
    
    // Performance tracking
    this.performanceData = {
      startTime: null,
      eventCount: 0,
      errorCount: 0,
      clickCount: 0
    };
  }

  /**
   * Initialize the SDK
   */
  async init(config) {
    if (this.isRecording) {
      console.warn('[SpectraView] Already recording');
      return;
    }

    // Validate config
    if (!config.apiKey) {
      console.warn('[SpectraView] No API key provided, running in offline mode');
    }
    
    if (!config.apiEndpoint) {
      console.warn('[SpectraView] No API endpoint provided, running in offline mode');
    }

    // Set configuration with defaults
    this.config = {
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint ? config.apiEndpoint.replace(/\/$/, '') : null, // Remove trailing slash
      appId: config.appId || 'unknown',
      userId: config.userId || null,
      
      // Recording options
      captureMode: config.captureMode || 'full', // full | privacy | minimal
      
      // Batching options
      batchSize: config.batchSize || 50,
      flushInterval: config.flushInterval || 30000, // 30 seconds
      
      // Storage options
      enableLocalStorage: config.enableLocalStorage !== false, // Default true
      maxLocalEvents: config.maxLocalEvents || 1000,
      
      // Privacy options
      maskAllInputs: config.maskAllInputs !== false, // Default true
      maskTextContent: config.maskTextContent || false,
      blockClass: config.blockClass || 'spectra-block',
      ignoreClass: config.ignoreClass || 'spectra-ignore',
      maskTextClass: config.maskTextClass || 'spectra-mask',
      
      // Performance options
      sampling: config.sampling || {
        scroll: 150,
        media: 800,
        input: 'last',
        mousemove: false, // Disabled by default for performance
        mouseInteraction: true
      },
      
      // Debug
      debug: config.debug || false
    };

    // Initialize session
    this.sessionId = uuidv4();
    this.userId = this.config.userId;
    this.performanceData.startTime = Date.now();

    // Initialize storage
    if (this.config.enableLocalStorage) {
      await this.initStorage();
    }

    // Start capturing
    this.startCapture();
    
    // Setup timers
    this.setupTimers();
    
    // Attach global listeners
    this.attachGlobalListeners();

    this.isRecording = true;
    
    this.log('SDK initialized', {
      sessionId: this.sessionId,
      userId: this.userId,
      appId: this.config.appId
    });

    // Send session start event (only if endpoint exists)
    if (this.config.apiEndpoint) {
      await this.sendSessionStart();
    }
  }

  /**
   * Initialize local storage
   */
  async initStorage() {
    this.storage = localforage.createInstance({
      name: 'spectraview',
      storeName: 'events'
    });

    // Clean old events
    await this.cleanOldEvents();
  }

  /**
   * Start capturing with rrweb
   */
  startCapture() {
    try {
      this.stopRecordingFn = rrweb.record({
        emit: (event, isCheckout) => {
          // Handle rrweb events
          this.handleRRWebEvent(event, isCheckout);
        },
        
        // Sampling configuration
        sampling: this.config.sampling,
        
        // Privacy configuration
        maskAllInputs: this.config.maskAllInputs,
        maskTextContent: this.config.maskTextContent,
        blockClass: this.config.blockClass,
        ignoreClass: this.config.ignoreClass,
        maskTextClass: this.config.maskTextClass,
        
        // Performance optimization
        packFn: pack,
        
        // Checkout configuration
        checkoutEveryNth: 100, // Full snapshot every 100 events
        checkoutEveryNms: 60000, // Full snapshot every minute
        
        // Advanced options
        recordCanvas: true,
        inlineStylesheet: true,
        collectFonts: true,
        
        // Plugin configuration
        plugins: []
      });
      
      this.log('rrweb recording started');
    } catch (error) {
      this.logError('Failed to start rrweb recording', error);
    }
  }

  /**
   * Handle rrweb events
   */
  handleRRWebEvent(event, isCheckout) {
    // Store the raw rrweb event directly for replay
    this.eventBuffer.push(event);

    this.performanceData.eventCount++;

    // Check if we should flush
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flush();
    }

    // Save to local storage if enabled
    if (this.config.enableLocalStorage) {
      this.saveEventLocal(event);
    }
  }

  /**
   * Attach global event listeners for custom events
   */
  attachGlobalListeners() {
    // Click tracking (for analytics beyond rrweb)
    document.addEventListener('click', this.handleClick.bind(this), true);
    
    // Error tracking
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
    
    // Navigation tracking
    this.trackNavigation();
    
    // Network tracking
    this.trackNetwork();
    
    // Console tracking
    this.trackConsole();
    
    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Before unload - flush events
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  /**
   * Handle click events (for custom analytics)
   */
  handleClick(event) {
    try {
      const target = event.target;
      const selector = this.getElementSelector(target);
      
      this.captureCustomEvent('click', {
        selector,
        text: target.textContent?.substring(0, 100), // Limit text length
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        href: target.href || null,
        coordinates: {
          x: event.pageX,
          y: event.pageY,
          screenX: event.screenX,
          screenY: event.screenY
        }
      });

      this.performanceData.clickCount++;
    } catch (error) {
      this.logError('Error handling click', error);
    }
  }

  /**
   * Handle JavaScript errors
   */
  handleError(event) {
    this.captureError({
      type: 'javascript_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: Date.now()
    });

    this.performanceData.errorCount++;
  }

  /**
   * Handle promise rejections
   */
  handlePromiseRejection(event) {
    this.captureError({
      type: 'unhandled_promise_rejection',
      reason: event.reason?.toString(),
      promise: event.promise?.toString(),
      timestamp: Date.now()
    });

    this.performanceData.errorCount++;
  }

  /**
   * Track navigation events
   */
  trackNavigation() {
    // Track pushState
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      this.captureCustomEvent('navigation', {
        type: 'pushState',
        url: args[2],
        state: args[0]
      });
      return originalPushState.apply(history, args);
    };

    // Track replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
      this.captureCustomEvent('navigation', {
        type: 'replaceState',
        url: args[2],
        state: args[0]
      });
      return originalReplaceState.apply(history, args);
    };

    // Track popstate
    window.addEventListener('popstate', (event) => {
      this.captureCustomEvent('navigation', {
        type: 'popstate',
        url: window.location.href,
        state: event.state
      });
    });

    // Track hash changes
    window.addEventListener('hashchange', (event) => {
      this.captureCustomEvent('navigation', {
        type: 'hashchange',
        oldURL: event.oldURL,
        newURL: event.newURL
      });
    });
  }

  /**
   * Track network requests
   */
  trackNetwork() {
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const [resource, config] = args;
      
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;
        
        // Only track API calls, not assets
        if (typeof resource === 'string' && !resource.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
          this.captureCustomEvent('network', {
            type: 'fetch',
            url: resource,
            method: config?.method || 'GET',
            status: response.status,
            duration,
            ok: response.ok
          });
        }
        
        return response;
      } catch (error) {
        this.captureCustomEvent('network', {
          type: 'fetch',
          url: resource,
          method: config?.method || 'GET',
          error: error.message,
          duration: performance.now() - startTime
        });
        throw error;
      }
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(...args) {
      this._spectraview = {
        method: args[0],
        url: args[1],
        startTime: null
      };
      return originalOpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._spectraview) {
        this._spectraview.startTime = performance.now();
        
        this.addEventListener('load', () => {
          const duration = performance.now() - this._spectraview.startTime;
          
          // Only track API calls
          if (!this._spectraview.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
            window.SpectraView?.captureCustomEvent('network', {
              type: 'xhr',
              url: this._spectraview.url,
              method: this._spectraview.method,
              status: this.status,
              duration
            });
          }
        });
        
        this.addEventListener('error', () => {
          window.SpectraView?.captureCustomEvent('network', {
            type: 'xhr',
            url: this._spectraview.url,
            method: this._spectraview.method,
            error: 'Network error',
            duration: performance.now() - this._spectraview.startTime
          });
        });
      }
      
      return originalSend.apply(this, args);
    };
  }

  /**
   * Track console events
   */
  trackConsole() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    
    methods.forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        // Don't track our own logs
        if (!args[0]?.toString().includes('[SpectraView]')) {
          this.captureCustomEvent('console', {
            level: method,
            message: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch {
                return String(arg);
              }
            }).join(' ').substring(0, 1000) // Limit message length
          });
        }
        
        return original.apply(console, args);
      };
    });
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    this.captureCustomEvent('visibility', {
      state: document.visibilityState,
      hidden: document.hidden
    });

    // Flush events when page becomes hidden
    if (document.hidden) {
      this.flush();
    }
  }

  /**
   * Handle before unload
   */
  handleBeforeUnload() {
    // Synchronous flush using sendBeacon
    this.flushSync();
  }

  /**
   * Capture custom event
   */
  captureCustomEvent(eventType, data) {
    const event = {
      type: 'custom',
      eventType,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };

    this.customEventBuffer.push(event);

    // Check if we should flush
    if (this.customEventBuffer.length >= 10) {
      this.flush();
    }
  }

  /**
   * Capture error
   */
  captureError(errorData) {
    const error = {
      ...errorData,
      sessionId: this.sessionId,
      timestamp: errorData.timestamp || Date.now(),
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };

    this.errorBuffer.push(error);

    // Errors should be sent immediately
    this.flush();
  }

  /**
   * Setup timers for batching and heartbeat
   */
  setupTimers() {
    // Batch timer
    this.batchTimer = setInterval(() => {
      if (this.eventBuffer.length > 0 || this.customEventBuffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);

    // Heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 60000); // Every minute
  }

  /**
   * Flush events to server
   */
  async flush() {
    if (!this.isRecording) return;

    const events = [...this.eventBuffer];
    const customEvents = [...this.customEventBuffer];
    const errors = [...this.errorBuffer];

    if (events.length === 0 && customEvents.length === 0 && errors.length === 0) {
      return;
    }

    // Only clear buffers if we have an API endpoint
    // Keep events for replay in offline mode
    if (this.config.apiEndpoint) {
      this.eventBuffer = [];
      this.customEventBuffer = [];
      this.errorBuffer = [];
    }

    try {
      // Prepare payload
      const payload = {
        sessionId: this.sessionId,
        userId: this.userId,
        appId: this.config.appId,
        events: this.compressEvents(events),
        customEvents,
        errors,
        metadata: {
          timestamp: Date.now(),
          eventCount: events.length,
          customEventCount: customEvents.length,
          errorCount: errors.length
        }
      };

      // Send to server (skip if no endpoint)
      if (this.config.apiEndpoint) {
        const response = await fetch(`${this.config.apiEndpoint}/sessions/${this.sessionId}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Session-ID': this.sessionId
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        // Running in offline mode, just log
        this.log('Offline mode: would send', payload.metadata);
      }

      this.log(`Flushed ${events.length} events, ${customEvents.length} custom events, ${errors.length} errors`);
      
      // Clear local storage for these events
      if (this.config.enableLocalStorage) {
        await this.clearSyncedEvents();
      }
    } catch (error) {
      this.logError('Failed to flush events', error);
      
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
      this.customEventBuffer.unshift(...customEvents);
      this.errorBuffer.unshift(...errors);
      
      // Save to local storage for later retry
      if (this.config.enableLocalStorage) {
        await this.saveFailedBatch({ events, customEvents, errors });
      }
    }
  }

  /**
   * Synchronous flush using sendBeacon (for page unload)
   */
  flushSync() {
    if (!this.isRecording) return;

    const events = [...this.eventBuffer];
    const customEvents = [...this.customEventBuffer];
    const errors = [...this.errorBuffer];

    if (events.length === 0 && customEvents.length === 0 && errors.length === 0) {
      return;
    }

    try {
      const payload = {
        sessionId: this.sessionId,
        userId: this.userId,
        appId: this.config.appId,
        events: this.compressEvents(events),
        customEvents,
        errors,
        metadata: {
          timestamp: Date.now(),
          final: true
        }
      };

      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${this.config.apiEndpoint}/sessions/${this.sessionId}/events`, blob);
      
      this.log('Sent beacon with events');
    } catch (error) {
      this.logError('Failed to send beacon', error);
    }
  }

  /**
   * Send session start event
   */
  async sendSessionStart() {
    if (!this.config.apiEndpoint) return;
    
    try {
      const payload = {
        sessionId: this.sessionId,
        userId: this.userId,
        appId: this.config.appId,
        startTime: this.performanceData.startTime,
        metadata: {
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          language: navigator.language,
          platform: navigator.platform
        }
      };

      const response = await fetch(`${this.config.apiEndpoint}/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.log('Session started');
    } catch (error) {
      this.logError('Failed to start session', error);
    }
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat() {
    if (!this.config.apiEndpoint) return;
    
    try {
      await fetch(`${this.config.apiEndpoint}/sessions/${this.sessionId}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Session-ID': this.sessionId
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          stats: this.performanceData
        })
      });
    } catch (error) {
      // Fail silently for heartbeat
    }
  }

  /**
   * Compress events
   */
  compressEvents(events) {
    try {
      const jsonString = JSON.stringify(events);
      const compressed = pako.deflate(jsonString);
      const base64 = btoa(String.fromCharCode.apply(null, compressed));
      return {
        compressed: true,
        data: base64
      };
    } catch (error) {
      this.logError('Failed to compress events', error);
      return {
        compressed: false,
        data: events
      };
    }
  }

  /**
   * Save event to local storage
   */
  async saveEventLocal(event) {
    if (!this.storage) return;

    try {
      const key = `event_${Date.now()}_${Math.random()}`;
      await this.storage.setItem(key, {
        event,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        synced: false
      });

      // Clean old events if necessary
      const keys = await this.storage.keys();
      if (keys.length > this.config.maxLocalEvents) {
        await this.cleanOldEvents();
      }
    } catch (error) {
      // Fail silently for local storage
    }
  }

  /**
   * Save failed batch to local storage
   */
  async saveFailedBatch(batch) {
    if (!this.storage) return;

    try {
      const key = `batch_${Date.now()}`;
      await this.storage.setItem(key, {
        ...batch,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        retryCount: 0
      });
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Clean old events from local storage
   */
  async cleanOldEvents() {
    if (!this.storage) return;

    try {
      const keys = await this.storage.keys();
      const items = [];

      for (const key of keys) {
        const item = await this.storage.getItem(key);
        items.push({ key, timestamp: item.timestamp || 0 });
      }

      // Sort by timestamp
      items.sort((a, b) => b.timestamp - a.timestamp);

      // Keep only recent events
      const toDelete = items.slice(this.config.maxLocalEvents);
      for (const item of toDelete) {
        await this.storage.removeItem(item.key);
      }
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Clear synced events
   */
  async clearSyncedEvents() {
    if (!this.storage) return;

    try {
      const keys = await this.storage.keys();
      
      for (const key of keys) {
        if (key.startsWith('event_')) {
          const item = await this.storage.getItem(key);
          if (item.synced) {
            await this.storage.removeItem(key);
          }
        }
      }
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Get element selector
   */
  getElementSelector(element) {
    if (!element) return '';

    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      
      if (element.id) {
        selector += `#${element.id}`;
        path.unshift(selector);
        break;
      } else if (element.className && typeof element.className === 'string') {
        selector += `.${element.className.split(' ').filter(c => c).join('.')}`;
      }
      
      path.unshift(selector);
      element = element.parentNode;
    }
    
    return path.join(' > ');
  }

  /**
   * Sanitize data to remove sensitive information
   */
  sanitizeData(data) {
    if (!data) return data;

    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone

    // Patterns to sanitize
    const patterns = [
      { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD]' },
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
      { regex: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '[EMAIL]' },
      { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' }
    ];

    // Recursively sanitize strings
    const sanitizeValue = (value) => {
      if (typeof value === 'string') {
        let sanitizedValue = value;
        patterns.forEach(pattern => {
          sanitizedValue = sanitizedValue.replace(pattern.regex, pattern.replacement);
        });
        return sanitizedValue;
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map(sanitizeValue);
        } else {
          const result = {};
          for (const key in value) {
            result[key] = sanitizeValue(value[key]);
          }
          return result;
        }
      }
      return value;
    };

    return sanitizeValue(sanitized);
  }

  /**
   * Stop recording
   */
  stop() {
    if (!this.isRecording) return;

    // Stop rrweb recording
    if (this.stopRecordingFn) {
      this.stopRecordingFn();
      this.stopRecordingFn = null;
    }

    // Clear timers
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Final flush
    this.flush();

    // Send session end
    this.sendSessionEnd();

    this.isRecording = false;
    this.log('Recording stopped');
  }

  /**
   * Send session end event
   */
  async sendSessionEnd() {
    if (!this.config.apiEndpoint) return;
    
    try {
      await fetch(`${this.config.apiEndpoint}/sessions/${this.sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Session-ID': this.sessionId
        },
        body: JSON.stringify({
          endTime: Date.now(),
          stats: this.performanceData
        })
      });
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Public API: Capture custom event
   */
  capture(eventName, data) {
    if (!this.isRecording) return;
    this.captureCustomEvent(eventName, data);
  }

  /**
   * Public API: Set user
   */
  setUser(userId, metadata = {}) {
    this.userId = userId;
    this.captureCustomEvent('identify', {
      userId,
      metadata
    });
  }

  /**
   * Public API: Add context
   */
  addContext(context) {
    this.sessionMetadata = {
      ...this.sessionMetadata,
      ...context
    };
    this.captureCustomEvent('context', context);
  }

  /**
   * Public API: Export captured events for debugging/replay
   */
  exportEvents() {
    // eventBuffer now contains raw rrweb events directly
    const rrwebEvents = [...this.eventBuffer];
    
    return {
      events: rrwebEvents,
      metadata: {
        sessionId: this.sessionId,
        userId: this.userId,
        appId: this.config?.appId,
        startTime: this.performanceData.startTime,
        eventCount: rrwebEvents.length,
        customEvents: this.customEventBuffer,
        errors: this.errorBuffer
      }
    };
  }

  /**
   * Public API: Download events as JSON file
   */
  downloadEvents() {
    const data = this.exportEvents();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spectraview-session-${this.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.log(`Downloaded ${data.events.length} events`);
  }

  /**
   * Public API: Get events for live replay
   */
  getReplayEvents() {
    // Return raw rrweb events from buffer
    return [...this.eventBuffer];
  }

  /**
   * Logging utilities
   */
  log(...args) {
    if (this.config?.debug) {
      console.log('[SpectraView]', ...args);
    }
  }

  logError(...args) {
    if (this.config?.debug) {
      console.error('[SpectraView]', ...args);
    }
  }
}

// Create singleton instance
const spectraView = new SpectraViewSDK();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = spectraView;
} else if (typeof define === 'function' && define.amd) {
  define([], () => spectraView);
} else {
  window.SpectraView = spectraView;
}

// Auto-initialize if config is present
if (typeof window !== 'undefined' && window.SPECTRAVIEW_CONFIG) {
  spectraView.init(window.SPECTRAVIEW_CONFIG);
}

export default spectraView;