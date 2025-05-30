// moleculer.config.example.js
// Example Moleculer configuration file

module.exports = {
  // Node identifier
  nodeID: "example-node",

  // Namespace for service names
  namespace: "",

  // Logging configuration
  logLevel: "info",
  logger: true,

  // Transporter configuration
  transporter: {
    type: "NATS",
    options: {
      url: "nats://localhost:4222",
      // Additional NATS options
      maxReconnectAttempts: 5,
      reconnectTimeWait: 2000
    }
  },

  // Cacher configuration
  cacher: {
    type: "Memory",
    options: {
      maxKeys: 1000,
      ttl: 30 // seconds
    }
  },

  // Serializer configuration
  serializer: "JSON",

  // Request timeout in milliseconds
  requestTimeout: 10 * 1000,

  // Retry policy configuration
  retryPolicy: {
    enabled: false,
    retries: 5,
    delay: 100,
    maxDelay: 1000,
    factor: 2,
    check: err => err && !!err.retryable
  },

  // Middlewares
  middlewares: [],

  // Registry & Discovery configuration
  registry: {
    strategy: "RoundRobin",
    preferLocal: true
  },

  // Circuit Breaker settings
  circuitBreaker: {
    enabled: false,
    threshold: 0.5,
    minRequestCount: 20,
    windowTime: 60, // seconds
    halfOpenTime: 10 * 1000 // milliseconds
  },

  // Bulkhead settings
  bulkhead: {
    enabled: false,
    concurrency: 10,
    maxQueueSize: 100
  },

  // Metrics configuration
  metrics: {
    enabled: false,
    reporter: [
      {
        type: "Console",
        options: {
          interval: 5, // seconds
          colors: true,
          onlyChanges: true
        }
      }
    ]
  },

  // Tracing configuration
  tracing: {
    enabled: false,
    exporter: {
      type: "Console",
      options: {
        colors: true,
        width: 100,
        gaugeWidth: 40
      }
    }
  },

  // Service dependencies timeout
  dependencyTimeout: 0,

  // Heartbeat configuration
  heartbeatInterval: 10, // seconds
  heartbeatTimeout: 30,  // seconds

  // Tracking configuration
  tracking: {
    enabled: false,
    shutdownTimeout: 5000
  },

  // Disable parameter validation
  validator: true,

  // Error handler
  errorHandler: null,

  // Created hook
  created(broker) {
    // broker.logger.info("Moleculer broker created!");
  },

  // Started hook
  started(broker) {
    // broker.logger.info("Moleculer broker started!");
  },

  // Stopped hook
  stopped(broker) {
    // broker.logger.info("Moleculer broker stopped!");
  }
};
