import { BridgeCli } from "../src/cli/BridgeCli";
import { BridgeOptions } from "../src/config/BridgeOptions";
import { BridgeBroker } from "../src/broker/BridgeBroker";
import { McpGateway } from "../src/mcp/McpGateway";
import * as fs from "fs";

// Mock dependencies
jest.mock("../src/config/BridgeOptions");
jest.mock("../src/broker/BridgeBroker");
jest.mock("../src/mcp/McpGateway");
jest.mock("../src/catalogue/ServiceCatalogue");
jest.mock("fs");

describe("BridgeCli", () => {
  let cli: BridgeCli;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockProcessExit: jest.SpyInstance;

  beforeEach(() => {
    cli = new BridgeCli();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      // Don't throw an error, just return undefined to simulate exit
      return undefined as never;
    });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe("start command", () => {
    let mockOptions: BridgeOptions;
    let mockBroker: jest.Mocked<BridgeBroker>;
    let mockGateway: jest.Mocked<McpGateway>;

    beforeEach(() => {
      mockOptions = {} as BridgeOptions;
      mockBroker = {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: true,
      } as any;
      mockGateway = {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: true,
      } as any;

      (BridgeOptions.load as jest.Mock).mockReturnValue(mockOptions);
      (BridgeBroker as jest.MockedClass<typeof BridgeBroker>).mockImplementation(() => mockBroker);
      (McpGateway as jest.MockedClass<typeof McpGateway>).mockImplementation(() => mockGateway);
    });

    it("should start bridge successfully", async () => {
      mockBroker.start.mockResolvedValue(undefined);
      mockGateway.start.mockResolvedValue(undefined);

      const promise = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      cli.run(['node', 'script', 'start']);

      await promise;

      expect(BridgeOptions.load).toHaveBeenCalledWith(undefined);
      expect(mockBroker.start).toHaveBeenCalled();
      expect(mockGateway.start).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("started successfully"));
    });

    it("should load config from provided path", async () => {
      mockBroker.start.mockResolvedValue(undefined);
      mockGateway.start.mockResolvedValue(undefined);

      const promise = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      cli.run(['node', 'script', 'start', 'config.json']);

      await promise;

      expect(BridgeOptions.load).toHaveBeenCalledWith('config.json');
    });

    it("should handle start errors", async () => {
      const error = new Error("Start failed");
      mockBroker.start.mockRejectedValue(error);

      cli.run(['node', 'script', 'start']);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockConsoleError).toHaveBeenCalledWith("Failed to start MCP Bridge:", expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("validate-config command", () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('{"allow":["*"]}');
      (BridgeOptions.validate as jest.Mock).mockImplementation(config => config);
    });

    it("should validate valid config", () => {
      cli.run(['node', 'script', 'validate-config', 'config.json']);

      expect(fs.existsSync).toHaveBeenCalledWith('config.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('config.json', 'utf8');
      expect(BridgeOptions.validate).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("valid"));
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("should handle missing config file", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      cli.run(['node', 'script', 'validate-config', 'missing.json']);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle invalid JSON", () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      cli.run(['node', 'script', 'validate-config', 'config.json']);

      expect(mockConsoleError).toHaveBeenCalledWith("❌ Configuration validation failed:", expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle validation errors", () => {
      (BridgeOptions.validate as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid config");
      });

      cli.run(['node', 'script', 'validate-config', 'config.json']);

      expect(mockConsoleError).toHaveBeenCalledWith("❌ Configuration validation failed:", expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("list-actions command", () => {
    let mockOptions: BridgeOptions;
    let mockBroker: jest.Mocked<BridgeBroker>;
    let mockServiceCatalogue: any;

    beforeEach(() => {
      mockOptions = {} as BridgeOptions;
      mockBroker = {
        start: jest.fn(),
        stop: jest.fn(),
        listActions: jest.fn().mockReturnValue([
          { name: "users.list" },
          { name: "posts.get" }
        ]),
        isRunning: true,
      } as any;

      mockServiceCatalogue = {
        getTools: jest.fn().mockReturnValue({
          "users_list": { description: "List users" },
          "posts_get": { description: "Get post" }
        })
      };

      (BridgeOptions.load as jest.Mock).mockReturnValue(mockOptions);
      (BridgeBroker as jest.MockedClass<typeof BridgeBroker>).mockImplementation(() => mockBroker);
      
      const { ServiceCatalogue } = require("../src/catalogue/ServiceCatalogue");
      ServiceCatalogue.mockImplementation(() => mockServiceCatalogue);
    });

    it("should list actions successfully", async () => {
      mockBroker.start.mockResolvedValue(undefined);
      mockBroker.stop.mockResolvedValue(undefined);

      const promise = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      cli.run(['node', 'script', 'list-actions']);

      await promise;

      expect(mockBroker.start).toHaveBeenCalled();
      expect(mockBroker.listActions).toHaveBeenCalled();
      expect(mockServiceCatalogue.getTools).toHaveBeenCalled();
      expect(mockBroker.stop).toHaveBeenCalled();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Available Actions"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Total actions found: 2"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Tools exposed via MCP: 2"));
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("should use provided config file", async () => {
      mockBroker.start.mockResolvedValue(undefined);
      mockBroker.stop.mockResolvedValue(undefined);

      const promise = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      cli.run(['node', 'script', 'list-actions', '--config', 'custom.json']);

      await promise;

      expect(BridgeOptions.load).toHaveBeenCalledWith('custom.json');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("should handle errors and cleanup", async () => {
      const error = new Error("List failed");
      mockBroker.start.mockRejectedValue(error);

      cli.run(['node', 'script', 'list-actions']);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockConsoleError).toHaveBeenCalledWith("Failed to list actions:", expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockBroker.stop).toHaveBeenCalled();
    });
  });

  describe("run", () => {
    it("should parse command line arguments", () => {
      // Test that the program runs without syntax errors when no command is provided
      // Commander.js will show help but won't throw an error
      expect(() => {
        const cli2 = new BridgeCli();
        cli2.run(['node', 'script']); // Run with minimal args - shows help
      }).not.toThrow();
    });
  });
});
