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
  
  // Build a mapping between MCP-compatible names and original Moleculer action names
  const mcpNameToActionMap: Record<string, string> = {};
  const usedSanitizedNames = new Set<string>();
  
  // Generate a simple description for each action based on its name
  function generateToolDescription(actionName: string): string {
    // Special handling for system actions
    if (actionName.startsWith('$node.')) {
      const actionPart = actionName.replace('$node.', '');
      return `Get ${actionPart} information from the Moleculer node`;
    }
    
    // Handle other common patterns
    if (actionName.includes('.')) {
      const parts = actionName.split('.');
      const service = parts[0];
      const method = parts[parts.length - 1];
      return `${method.charAt(0).toUpperCase() + method.slice(1)} operation for the ${service} service`;
    }
    
    // Generic fallback
    return `Execute the ${actionName} action`;
  }
  
  // Helper function to sanitize action names for MCP compatibility
  function sanitizeActionName(actionName: string): string {
    // MCP tools must match /^[A-Za-z0-9_]{1,64}$/
    let sanitized = actionName
      .replace(/[^A-Za-z0-9_]/g, "_") // Replace invalid chars with underscore
      .toLowerCase()
      .trim(); // Trim and lowercase
      
    // Ensure the name isn't empty (though this shouldn't happen)
    if (sanitized === "") {
      sanitized = "action";
    }
    
    // Ensure no duplicates by adding numeric suffix if needed
    let finalName = sanitized;
    let counter = 1;
    
    while (usedSanitizedNames.has(finalName)) {
      finalName = `${sanitized}_${counter++}`;
      
      // Safety check to prevent infinite loops
      if (counter > 1000) {
        throw new Error("Failed to generate unique sanitized action name");
      }
    }
    
    // Add to used names to prevent duplicates
    usedSanitizedNames.add(finalName);
    
    return finalName;
  }
  
  // Create mapping from sanitized names to original action names
  actionList.forEach(action => {
    const originalName = action.name;
    const needsSanitization = !/^[A-Za-z0-9_]{1,64}$/.test(originalName);
    
    if (needsSanitization) {
      const sanitizedName = sanitizeActionName(originalName);
      mcpNameToActionMap[sanitizedName] = originalName;
    } else {
      // For valid names, still need to check for duplicates after lowercasing
      const lowerName = originalName.toLowerCase();
      if (usedSanitizedNames.has(lowerName)) {
        // Even though the original name is valid, we need to sanitize due to case collision
        const sanitizedName = sanitizeActionName(originalName);
        mcpNameToActionMap[sanitizedName] = originalName;
      } else {
        usedSanitizedNames.add(lowerName);
        mcpNameToActionMap[lowerName] = originalName;
      }
    }
  });
  
  // Log the mapping for visibility
  console.log("Action name mapping for MCP compatibility:");
  Object.entries(mcpNameToActionMap).forEach(([mcpName, originalName]) => {
    if (mcpName !== originalName.toLowerCase()) {
      console.log(`  ${mcpName} -> ${originalName}`);
    }
  });
  
  // Handle MCP requests at root path as well as v1/mcp for better compatibility
  app.post(['/', '/v1/mcp'], async (req: Request, res: Response) => {
    try {
      // Create a new MCP server instance for each request in stateless mode
      const server = new McpServer({
        name: "Moleculer-MCP-Bridge",
        version: "1.0.0",
      });
      
      // Register each action as an MCP tool using appropriate name
      for (const action of actionList) {
        const originalActionName = action.name;
        const mcpToolName = Object.entries(mcpNameToActionMap)
          .find(([_, origName]) => origName === originalActionName)?.[0] || originalActionName.toLowerCase();
        
        // Generate a description for this tool
        const toolDescription = generateToolDescription(originalActionName);
        
        // Create a basic parameter schema for the action
        // In a production environment, we could extract more detailed param schemas from Moleculer
        const paramSchema: Record<string, any> = {};
        
        server.tool(
          mcpToolName,
          toolDescription, // Pass description as the second parameter
          paramSchema,     // Parameter schema as third parameter
          async (args: Record<string, any>) => {
            try {
              // Forward request to Moleculer using the original action name
              console.log(`MCP tool name: ${mcpToolName}`);
              console.log(`Calling action: ${originalActionName} with args:`, args);
              const result = await broker.call(originalActionName, args);
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