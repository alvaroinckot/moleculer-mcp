import { ServiceBroker } from "moleculer";
import { ActionSchema } from "moleculer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import { Request, Response } from "express";

// Type definitions to work with Moleculer actions and validation schemas
interface ActionInfo {
  name: string;
  action?: ActionSchema;
  definition?: {
    params?: Record<string, any>;
  };
}

// Utility function to convert Fastest-Validator schema to Zod schema properties
function convertToZodSchemaProps(schema: any): Record<string, z.ZodTypeAny> {
  if (!schema) return {};
  
  const result: Record<string, z.ZodTypeAny> = {};
  
  if (typeof schema === 'object' && !Array.isArray(schema)) {
    // Extract properties from the schema object
    const props = schema.props || schema;
    
    for (const [key, propSchema] of Object.entries(props)) {
      if (key === '$$strict' || key === '$$async') continue;
      
      let zodProp: z.ZodTypeAny;
      
      // Handle different types
      if (typeof propSchema === 'string') {
        switch (propSchema) {
          case 'string': zodProp = z.string(); break;
          case 'number': zodProp = z.number(); break;
          case 'boolean': zodProp = z.boolean(); break;
          case 'date': zodProp = z.date(); break;
          case 'email': zodProp = z.string().email(); break;
          case 'url': zodProp = z.string().url(); break;
          case 'uuid': zodProp = z.string().uuid(); break;
          default: zodProp = z.any(); break;
        }
      } else if (Array.isArray(propSchema)) {
        // Array type
        if (propSchema.length === 0) {
          zodProp = z.array(z.any());
        } else {
          // Use first item as array type
          const itemProps = convertToZodSchemaProps({ item: propSchema[0] });
          zodProp = z.array(itemProps.item || z.any());
        }
      } else if (typeof propSchema === 'object' && propSchema !== null) {
        // Object type or complex type definition
        if (propSchema && 'type' in propSchema && propSchema.type === 'array') {
          if ('items' in propSchema && propSchema.items) {
            const itemProps = convertToZodSchemaProps({ item: propSchema.items });
            zodProp = z.array(itemProps.item || z.any());
          } else {
            zodProp = z.array(z.any());
          }
        } else if ((propSchema && 'type' in propSchema && propSchema.type === 'object') || 
                  (propSchema && 'props' in propSchema)) {
          // Nested object
          const nestedProps = convertToZodSchemaProps(propSchema);
          zodProp = z.object(nestedProps);
        } else if (propSchema && 'type' in propSchema) {
          // Simple type with definition
          switch (propSchema.type) {
            case 'string': zodProp = z.string(); break;
            case 'number': zodProp = z.number(); break;
            case 'boolean': zodProp = z.boolean(); break;
            case 'date': zodProp = z.date(); break;
            case 'email': zodProp = z.string().email(); break;
            case 'url': zodProp = z.string().url(); break;
            case 'uuid': zodProp = z.string().uuid(); break;
            default: zodProp = z.any(); break;
          }
        } else {
          // Fallback for other object definitions
          zodProp = z.object(convertToZodSchemaProps(propSchema));
        }
        
        // Handle optional flag
        if (propSchema && 'optional' in propSchema && propSchema.optional === true) {
          zodProp = zodProp.optional();
        }
      } else {
        // Default for unrecognized types
        zodProp = z.any();
      }
      
      result[key] = zodProp;
    }
  }
  
  return result;
}

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

  // Get all actions from registry without endpoints
  const actionList = broker.registry.getActionList({ withEndpoints: false }) as unknown as ActionInfo[];
  
  // Build a mapping between MCP-compatible names and original Moleculer action names
  const nameMap: Record<string, string> = {};
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
  
  // Extract schemas and create name mapping
  const actionSchemaShapes: Record<string, Record<string, z.ZodTypeAny>> = {};
  const requiredKeysMap: Record<string, string[]> = {};
  
  actionList.forEach(action => {
    const originalName = action.name;
    // Apply naming rules: if the name contains anything but ASCII letters, digits or underscores,
    // replace invalid runs with "_", lower-case, trim, and append a numeric suffix on collision
    const safeName = sanitizeActionName(originalName);
    
    // Build the name mapping
    nameMap[safeName] = originalName;
    
    // Extract the parameter schema from the action definition
    const paramsSchema = action?.definition?.params || action.action?.params || {};

    
    // Convert the Fastest-Validator schema to Zod schema properties
    const zodSchemaProps = convertToZodSchemaProps(paramsSchema);
    actionSchemaShapes[safeName] = zodSchemaProps;
    
    // Identify required keys for logging
    const requiredKeys: string[] = [];
    if (typeof paramsSchema === 'object' && paramsSchema !== null) {
      for (const [key, propSchema] of Object.entries(paramsSchema)) {
        if (key === '$$strict' || key === '$$async') continue;
        
        // Check if the property is required (doesn't have optional flag)
        const isRequired = typeof propSchema === 'object' && propSchema !== null 
          ? !(propSchema.optional === true) 
          : true;
          
        if (isRequired) {
          requiredKeys.push(key);
        }
      }
    }
    requiredKeysMap[safeName] = requiredKeys;
    
    // Log the mapping and required keys
    console.log({ safeName, originalName, requiredKeys });
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
      for (const [safeName, originalName] of Object.entries(nameMap)) {
        const toolDescription = generateToolDescription(originalName);
        const zodSchemaShape = actionSchemaShapes[safeName];
        server.tool(
          safeName,
          toolDescription,
          // Pass the raw schema shape directly, not a Zod object
          zodSchemaShape,
          async (args, extra) => {
            try {
              // Forward request to Moleculer using the original action name
              console.log(`MCP tool '${safeName}' calling action '${originalName}' with args:`, args);
              const result = await broker.call(originalName, args);
              // Return the result in the format expected by MCP
              return {
                structuredContent: { result },
                content: [{ type: "text", text: JSON.stringify(result) }]
              };
            } catch (error) {
              console.error(`Error calling ${originalName}:`, error);
              throw error;
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