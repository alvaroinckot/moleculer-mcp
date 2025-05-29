import { ServiceSchema } from "moleculer";
import { BridgeOptions } from "../config/BridgeOptions";
import { BridgeBroker } from "../broker/BridgeBroker";
import { McpGateway } from "../mcp/McpGateway";

export const McpBridgeService: ServiceSchema = {
  name: "mcp-bridge",
  
  settings: {
    // Default settings - can be overridden when creating the service
    bridge: {
      allow: ['*'],
      tools: [],
      broker: {
        nodeID: "mcp-bridge",
        transporter: "NATS",
        logLevel: "error",
      },
      server: {
        port: 3000,
        name: "Moleculer-MCP-Bridge",
        version: "1.0.0",
      },
    }
  },

  created() {
    // Initialize bridge components when service is created
    this.bridgeOptions = new BridgeOptions(this.settings.bridge);
    this.bridgeBroker = new BridgeBroker(this.bridgeOptions);
    this.mcpGateway = new McpGateway(this.bridgeOptions, this.bridgeBroker);
  },

  async started() {
    // Start the bridge broker and gateway when service starts
    try {
      await this.bridgeBroker.start();
      await this.mcpGateway.start();
      this.logger.info("MCP Bridge Service started successfully");
    } catch (error) {
      this.logger.error("Failed to start MCP Bridge Service:", error);
      throw error;
    }
  },

  async stopped() {
    // Stop the gateway and broker when service stops
    try {
      if (this.mcpGateway) {
        await this.mcpGateway.stop();
      }
      if (this.bridgeBroker) {
        await this.bridgeBroker.stop();
      }
      this.logger.info("MCP Bridge Service stopped successfully");
    } catch (error) {
      this.logger.error("Failed to stop MCP Bridge Service:", error);
      throw error;
    }
  },

  actions: {
    // Health check action
    health: {
      rest: "GET /health",
      async handler() {
        return {
          status: "ok",
          broker: this.bridgeBroker?.isRunning || false,
          gateway: this.mcpGateway?.isRunning || false,
          timestamp: new Date().toISOString(),
        };
      }
    },

    // List available tools
    "list-tools": {
      rest: "GET /tools",
      async handler() {
        if (!this.bridgeBroker?.isRunning) {
          throw new Error("Bridge broker is not running");
        }
        
        const catalogue = new (await import("../catalogue/ServiceCatalogue")).ServiceCatalogue(
          this.bridgeBroker, 
          this.bridgeOptions
        );
        
        const tools = catalogue.getTools();
        return Object.keys(tools).map(name => {
          const tool = tools[name];
          if (!tool) {
            throw new Error(`Tool '${name}' not found`);
          }
          return {
            name,
            description: tool.description,
          };
        });
      }
    },
  },
};
