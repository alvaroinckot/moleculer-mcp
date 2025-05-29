import { McpGateway } from '../src/mcp/McpGateway';
import { BridgeBroker, BridgeError } from '../src/broker/BridgeBroker';
import { BridgeOptions } from '../src/config/BridgeOptions';

describe('McpGateway', () => {
  let mockBroker: Partial<BridgeBroker>;
  let mockOptions: BridgeOptions;

  beforeEach(() => {
    // Setup mock broker with proper properties
    mockBroker = {
      get isRunning() { return true; },
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      call: jest.fn().mockResolvedValue({ result: 'success' }),
      listActions: jest.fn().mockReturnValue([
        { name: 'users.get', params: {} },
        { name: 'users.list', params: {} },
      ]),
    };

    // Setup mock options using proper BridgeOptions constructor
    mockOptions = new BridgeOptions({
      allow: ['*'],
      server: {
        name: 'test-server',
        version: '1.0.0',
        port: 3000,
      },
      broker: {
        nodeID: 'test-node',
        transporter: 'memory://test',
        logLevel: 'info',
      },
    });
  });

  describe('constructor', () => {
    it('should create gateway instance', () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      expect(gateway).toBeInstanceOf(McpGateway);
    });

    it('should initialize as not started', () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      expect(gateway.isRunning).toBe(false);
    });
  });

  describe('start() validation', () => {
    it('should throw error if broker is not running', async () => {
      // Create a broker that's not running
      const notRunningBroker = {
        get isRunning() { return false; },
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        call: jest.fn().mockResolvedValue({ result: 'success' }),
        listActions: jest.fn().mockReturnValue([]),
      };
      
      const gateway = new McpGateway(mockOptions, notRunningBroker as unknown as BridgeBroker);
      
      await expect(gateway.start()).rejects.toThrow(BridgeError);
      await expect(gateway.start()).rejects.toThrow('Broker must be started before gateway');
    });

    it('should throw error if already started', async () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      
      // Mock the internal state to simulate already started
      (gateway as any).isStarted = true;
      
      await expect(gateway.start()).rejects.toThrow(BridgeError);
      await expect(gateway.start()).rejects.toThrow('Gateway is already started');
    });
  });

  describe('isRunning property', () => {
    it('should return false initially', () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      expect(gateway.isRunning).toBe(false);
    });

    it('should reflect internal isStarted state', () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      
      // Simulate started state
      (gateway as any).isStarted = true;
      expect(gateway.isRunning).toBe(true);
      
      // Simulate stopped state
      (gateway as any).isStarted = false;
      expect(gateway.isRunning).toBe(false);
    });
  });

  describe('stop() behavior', () => {
    it('should resolve immediately if not started', async () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      
      // Should not throw when stopping a gateway that was never started
      await expect(gateway.stop()).resolves.toBeUndefined();
    });

    it('should resolve immediately if server is null', async () => {
      const gateway = new McpGateway(mockOptions, mockBroker as unknown as BridgeBroker);
      
      // Simulate started but with null server
      (gateway as any).isStarted = true;
      (gateway as any).server = null;
      
      await expect(gateway.stop()).resolves.toBeUndefined();
    });
  });
});