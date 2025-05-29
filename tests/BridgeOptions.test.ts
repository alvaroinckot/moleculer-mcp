import { BridgeOptions, DEFAULTS } from "../src/config/BridgeOptions";
import * as fs from "fs";
import * as path from "path";

describe("BridgeOptions", () => {
  const tempConfigPath = path.join(__dirname, "temp-config.json");

  afterEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
    delete process.env.MCP_BRIDGE_SETTINGS;
  });

  describe("constructor", () => {
    it("should create instance with default values", () => {
      const options = new BridgeOptions({});
      
      expect(options.allow).toEqual(DEFAULTS.allow);
      expect(options.tools).toEqual(DEFAULTS.tools);
      expect(options.broker.nodeID).toBe(DEFAULTS.broker.nodeID);
      expect(options.server.port).toBe(DEFAULTS.server.port);
    });

    it("should merge provided options with defaults", () => {
      const customOptions = {
        allow: ["posts.*"],
        server: { port: 4000 }
      };
      
      const options = new BridgeOptions(customOptions);
      
      expect(options.allow).toEqual(["posts.*"]);
      expect(options.server.port).toBe(4000);
      expect(options.broker.nodeID).toBe(DEFAULTS.broker.nodeID); // Should use default
    });
  });

  describe("load", () => {
    it("should load from file path", () => {
      const config = {
        allow: ["test.*"],
        tools: [{ name: "test", action: "test.action", description: "Test" }]
      };
      
      fs.writeFileSync(tempConfigPath, JSON.stringify(config));
      
      const options = BridgeOptions.load(tempConfigPath);
      
      expect(options.allow).toEqual(["test.*"]);
      expect(options.tools).toHaveLength(1);
    });

    it("should throw error for non-existent file", () => {
      expect(() => {
        BridgeOptions.load("/non/existent/path.json");
      }).toThrow("Configuration file not found");
    });

    it("should load from environment variable when no file path", () => {
      const config = { allow: ["env.*"] };
      process.env.MCP_BRIDGE_SETTINGS = JSON.stringify(config);
      
      const options = BridgeOptions.load();
      
      expect(options.allow).toEqual(["env.*"]);
    });

    it("should throw error for invalid JSON in environment variable", () => {
      process.env.MCP_BRIDGE_SETTINGS = "invalid json";
      
      expect(() => {
        BridgeOptions.load();
      }).toThrow("Failed to parse MCP_BRIDGE_SETTINGS");
    });
  });

  describe("validate", () => {
    it("should validate correct options", () => {
      const validOptions = {
        allow: ["*"],
        tools: [{ name: "test", action: "test.action", description: "Test" }]
      };
      
      const result = BridgeOptions.validate(validOptions);
      
      expect(result).toEqual(validOptions);
    });

    it("should throw error for invalid options", () => {
      const invalidOptions = {
        allow: "not an array"
      };
      
      expect(() => {
        BridgeOptions.validate(invalidOptions);
      }).toThrow();
    });
  });

  describe("readonly properties", () => {
    it("should return frozen arrays and objects", () => {
      const options = new BridgeOptions({
        allow: ["test.*"],
        tools: [{ name: "test", action: "test.action", description: "Test" }]
      });
      
      expect(Object.isFrozen(options.allow)).toBe(true);
      expect(Object.isFrozen(options.tools)).toBe(true);
      expect(Object.isFrozen(options.broker)).toBe(true);
      expect(Object.isFrozen(options.server)).toBe(true);
    });
  });
});
