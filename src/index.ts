import { ServiceBroker } from "moleculer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import { Request, Response } from "express";

async function main() {
  // Initialize Moleculer broker with NATS transporter
  const broker = new ServiceBroker({
    nodeID: "mcp-bridge",
    transporter: "NATS",
  });

  const app = express();
  app.use(express.json());

  // Start the broker
  await broker.start();

  // Wait for service discovery
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Get all actions from registry
  const actionList = broker.registry.getActionList({});
  
  // Handle MCP requests at root path as well as v1/mcp for better compatibility
  app.post(['/', '/v1/mcp'], async (req: Request, res: Response) => {
    try {
      // Create a new MCP server instance for each request in stateless mode
      const server = new McpServer({
        name: "Moleculer-MCP-Bridge",
        version: "1.0.0",
      });
      
      // Register each action as an MCP tool
      for (const action of actionList) {
        const actionName = action.name;
        
        // Create a basic parameter schema for the action
        // In a production environment, we could extract more detailed param schemas from Moleculer
        const paramSchema: Record<string, any> = {};
        
        server.tool(
          actionName,
          paramSchema,
          async (args: Record<string, any>) => {
            try {
              // Forward request to Moleculer
              const result = await broker.call(actionName, args);
              return { 
                content: [{ 
                  type: "text", 
                  text: JSON.stringify(result, null, 2) 
                }]
              };
            } catch (error) {
              return { 
                content: [{ 
                  type: "text", 
                  text: `Error: ${error instanceof Error ? error.message : String(error)}` 
                }],
                isError: true
              };
            }
          }
        );
      }
      
      // Set up transport for this request - use stateless mode
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });
      
      // Connect the transport to the server
      await server.connect(transport);
      
      // Handle the request
      await transport.handleRequest(req, res, req.body);
      
      // Clean up when request is done
      res.on('close', () => {
        transport.close();
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // Placeholder routes for GET and DELETE to complete the transport implementation
  // Support both root path and v1/mcp path
  app.get(['/', '/v1/mcp'], (req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed',
      },
      id: null,
    });
  });

  app.delete(['/', '/v1/mcp'], (req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed',
      },
      id: null,
    });
  });

  // Start the HTTP server
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`MCP server started on port ${PORT}`);
    console.log(`Endpoints: http://localhost:${PORT}/ and http://localhost:${PORT}/v1/mcp`);
    console.log(`Exposed ${actionList.length} Moleculer actions as MCP tools`);
  });
}

main().catch(console.error);