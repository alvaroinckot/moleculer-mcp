import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Express, Request, Response } from "express";
import { BridgeOptions } from "../config/BridgeOptions";
import { BridgeBroker, BridgeError } from "../broker/BridgeBroker";
import { ServiceCatalogue } from "../catalogue/ServiceCatalogue";

export class McpGateway {
  private app: Express;
  private server: any;
  private isStarted = false;
  private serviceCatalogue: ServiceCatalogue | null = null;

  constructor(
    private readonly options: BridgeOptions,
    private readonly broker: BridgeBroker
  ) {
    this.app = express();
    this.app.use(express.json());
    // Routes will be set up in start() method when serviceCatalogue is available
  }

  private setupRoutes(): void {
    // Handle MCP requests at root path and v1/mcp for better compatibility
    this.app.post(["/", "/v1/mcp"], this.handleMcpRequest.bind(this));

    // Placeholder routes for GET and DELETE to complete the transport implementation
    this.app.get(["/", "/v1/mcp"], this.handleMethodNotAllowed.bind(this));
    this.app.delete(["/", "/v1/mcp"], this.handleMethodNotAllowed.bind(this));
  }

  private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    try {
      // Create a new MCP server instance for each request in stateless mode
      const mcpServer = new McpServer({
        name: this.options.server.name,
        version: this.options.server.version,
      });

      // Register tools from service catalogue
      if (!this.serviceCatalogue) {
        throw new Error("Service catalogue not initialized. Call start() first.");
      }

      const tools = this.serviceCatalogue.getTools();

      for (const [toolName, toolConfig] of Object.entries(tools)) {
        mcpServer.tool(toolName, toolConfig.description, toolConfig.schema, toolConfig.handler);
      }

      // Set up transport for this request - use stateless mode
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      // Connect the transport to the server
      await mcpServer.connect(transport as any);

      // Handle the request
      await transport.handleRequest(req, res, req.body);

      // Clean up when request is done
      res.on("close", () => {
        transport.close();
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  }

  private handleMethodNotAllowed(req: Request, res: Response): void {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed",
      },
      id: null,
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new BridgeError("Gateway is already started");
    }

    if (!this.broker.isRunning) {
      throw new BridgeError("Broker must be started before gateway");
    }

    // Create service catalogue now that broker is running
    this.serviceCatalogue = new ServiceCatalogue(this.broker, this.options);

    // Set up routes now that serviceCatalogue is available
    this.setupRoutes();

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.server.port, () => {
          this.isStarted = true;
          console.log(`MCP server started on port ${this.options.server.port}`);
          console.log(
            `Endpoints: http://localhost:${this.options.server.port}/ and http://localhost:${this.options.server.port}/v1/mcp`
          );

          const toolCount = Object.keys(this.serviceCatalogue!.getTools()).length;
          console.log(`Exposed ${toolCount} Moleculer actions as MCP tools`);

          resolve();
        });

        this.server.on("error", (error: Error) => {
          reject(new BridgeError(`Failed to start gateway: ${error.message}`));
        });
      } catch (error) {
        reject(new BridgeError(`Failed to start gateway: ${error}`));
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isStarted || !this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server!.close((error?: Error) => {
          if (error) {
            reject(new BridgeError(`Failed to stop gateway: ${error.message}`));
          } else {
            this.isStarted = false;
            this.server = null;
            resolve();
          }
        });
      } catch (error) {
        reject(new BridgeError(`Failed to stop gateway: ${error}`));
      }
    });
  }

  get isRunning(): boolean {
    return this.isStarted;
  }
}
