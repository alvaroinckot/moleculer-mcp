import { BridgeBroker, BridgeError } from "../src/broker/BridgeBroker";
import { BridgeOptions } from "../src/config/BridgeOptions";

// Create mock service broker instance
const mockServiceBroker = {
  start: jest.fn(),
  stop: jest.fn(),
  call: jest.fn(),
  registry: {
    getActionList: jest.fn().mockReturnValue([
      { name: "test.action", action: { params: {} } },
      { name: "users.list", action: { params: { limit: "number" } } }
    ])
  }
};

// Mock the entire moleculer module
jest.mock("moleculer", () => ({
  ServiceBroker: jest.fn().mockImplementation(() => mockServiceBroker)
}));

describe("BridgeBroker", () => {
  let broker: BridgeBroker;
  let options: BridgeOptions;

  beforeEach(() => {
    // Reset all mock functions
    jest.clearAllMocks();
    
    options = new BridgeOptions({});
    broker = new BridgeBroker(options);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create broker with correct configuration", () => {
      const { ServiceBroker } = require("moleculer");
      
      expect(ServiceBroker).toHaveBeenCalledWith({
        nodeID: options.broker.nodeID,
        transporter: options.broker.transporter,
        logLevel: options.broker.logLevel,
      });
    });
  });

  describe("start", () => {
    it("should start broker successfully", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      
      await broker.start();
      
      expect(mockServiceBroker.start).toHaveBeenCalled();
      expect(broker.isRunning).toBe(true);
    });

    it("should throw error if already started", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      
      await broker.start();
      
      await expect(broker.start()).rejects.toThrow(BridgeError);
      await expect(broker.start()).rejects.toThrow("already started");
    });

    it("should throw BridgeError on start failure", async () => {
      const error = new Error("Start failed");
      mockServiceBroker.start.mockRejectedValue(error);
      
      await expect(broker.start()).rejects.toThrow(BridgeError);
      await expect(broker.start()).rejects.toThrow("Failed to start broker");
    });
  });

  describe("stop", () => {
    it("should stop broker successfully", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      mockServiceBroker.stop.mockResolvedValue(undefined);
      
      await broker.start();
      await broker.stop();
      
      expect(mockServiceBroker.stop).toHaveBeenCalled();
      expect(broker.isRunning).toBe(false);
    });

    it("should not throw if broker is not started", async () => {
      await expect(broker.stop()).resolves.not.toThrow();
    });

    it("should throw BridgeError on stop failure", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      mockServiceBroker.stop.mockRejectedValue(new Error("Stop failed"));
      
      await broker.start();
      
      await expect(broker.stop()).rejects.toThrow(BridgeError);
      await expect(broker.stop()).rejects.toThrow("Failed to stop broker");
    });
  });

  describe("listActions", () => {
    it("should return actions when broker is running", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      
      await broker.start();
      const actions = broker.listActions();
      
      expect(actions).toHaveLength(2);
      expect(actions[0]?.name).toBe("test.action");
      expect(actions[1]?.name).toBe("users.list");
    });

    it("should throw error when broker is not running", () => {
      expect(() => broker.listActions()).toThrow(BridgeError);
      expect(() => broker.listActions()).toThrow("not started");
    });
  });

  describe("call", () => {
    it("should call action successfully", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      mockServiceBroker.call.mockResolvedValue({ result: "success" });
      
      await broker.start();
      const result = await broker.call("test.action", { param: "value" });
      
      expect(mockServiceBroker.call).toHaveBeenCalledWith("test.action", { param: "value" });
      expect(result).toEqual({ result: "success" });
    });

    it("should throw error when broker is not running", async () => {
      await expect(broker.call("test.action", {})).rejects.toThrow(BridgeError);
      await expect(broker.call("test.action", {})).rejects.toThrow("not started");
    });

    it("should throw BridgeError on call failure", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      mockServiceBroker.call.mockRejectedValue(new Error("Call failed"));
      
      await broker.start();
      
      await expect(broker.call("test.action", {})).rejects.toThrow(BridgeError);
      await expect(broker.call("test.action", {})).rejects.toThrow("Failed to call action");
    });
  });

  describe("isRunning", () => {
    it("should return false initially", () => {
      expect(broker.isRunning).toBe(false);
    });

    it("should return true after start", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      
      await broker.start();
      
      expect(broker.isRunning).toBe(true);
    });

    it("should return false after stop", async () => {
      mockServiceBroker.start.mockResolvedValue(undefined);
      mockServiceBroker.stop.mockResolvedValue(undefined);
      
      await broker.start();
      await broker.stop();
      
      expect(broker.isRunning).toBe(false);
    });
  });
});
