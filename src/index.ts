import { ServiceBroker } from "moleculer";
import { ActionSchema } from "moleculer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// Type definitions to work with Moleculer actions and validation schemas
interface ActionInfo {
  name: string;
  action?: ActionSchema;
  definition?: {
    params?: Record<string, any>;
  };
}

// Settings configuration interfaces
interface CustomTool {
  name: string;
  action: string;
  description: string;
  params?: Record<string, any>; // Override default parameters
}

interface BridgeSettings {
  allow?: string[];
  tools?: CustomTool[];
}

// Default settings - allow all actions if no settings provided
const DEFAULT_SETTINGS: BridgeSettings = {
  allow: ['*'],
  tools: []
};

// Utility function to check if an action is allowed based on patterns
function isActionAllowed(actionName: string, allowPatterns: string[]): boolean {
  return allowPatterns.some(pattern => {
    if (pattern === '*') {
      return true;
    }
    
    if (pattern.endsWith('*')) {
      // Wildcard pattern like "posts.*"
      const prefix = pattern.slice(0, -1);
      return actionName.startsWith(prefix);
    }
    
    // Exact match
    return actionName === pattern;
  });
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

// Function to load settings from file path, environment variable, or use defaults
function loadSettings(): BridgeSettings {
  let settings: BridgeSettings = DEFAULT_SETTINGS;

  // Check for command line argument --settings or --config
  const args = process.argv.slice(2);
  const settingsIndex = args.findIndex(arg => arg === '--settings' || arg === '--config');
  
  if (settingsIndex !== -1 && args[settingsIndex + 1]) {
    const settingsPath = args[settingsIndex + 1];
    try {
      if (!fs.existsSync(settingsPath)) {
        console.error(`Settings file not found: ${settingsPath}`);
        process.exit(1);
      }
      
      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      const fileSettings = JSON.parse(settingsContent);
      settings = { ...DEFAULT_SETTINGS, ...fileSettings };
      console.log(`Loaded settings from file: ${path.resolve(settingsPath)}`);
      console.log('Settings:', JSON.stringify(settings, null, 2));
      return settings;
    } catch (error) {
      console.error(`Failed to load settings from ${settingsPath}:`, error);
      process.exit(1);
    }
  }

  // Fallback to environment variable
  const settingsEnv = process.env.MCP_BRIDGE_SETTINGS;
  if (settingsEnv) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsEnv) };
      console.log('Loaded settings from MCP_BRIDGE_SETTINGS environment variable');
      console.log('Settings:', JSON.stringify(settings, null, 2));
      return settings;
    } catch (error) {
      console.warn('Failed to parse MCP_BRIDGE_SETTINGS, using defaults:', error);
    }
  }

  console.log('Using default settings (allow all actions)');
  return settings;
}

async function main() {
  // Load settings from file path, environment variable, or use defaults
  const settings = loadSettings();

  // Initialize Moleculer broker with NATS transporter
  const broker = new ServiceBroker({
    nodeID: "mcp-bridge",
    transporter: "NATS",
    logLevel: "error"
  });

  const app = express();
  app.use(express.json());

  // Start the broker
  await broker.start();

  // Wait for service discovery
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Get all actions from registry without endpoints
  const actionList = broker.registry.getActionList({ withEndpoints: false }) as unknown as ActionInfo[];
  
  // Filter actions based on allow patterns
  const allowedActions = actionList.filter(action => 
    isActionAllowed(action.name, settings.allow || ['*'])
  );
  
  console.log(`Found ${actionList.length} total actions, ${allowedActions.length} allowed by settings`);
  
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
  const toolDescriptions: Record<string, string> = {};
  const paramOverrides: Record<string, Record<string, any>> = {};
  
  // First, process custom tools from settings
  if (settings.tools) {
    settings.tools.forEach(customTool => {
      // Find the action in the allowed actions list
      const action = allowedActions.find(a => a.name === customTool.action);
      if (action) {
        const safeName = customTool.name.replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();
        
        // Ensure uniqueness
        let finalName = safeName;
        let counter = 1;
        while (nameMap[finalName]) {
          finalName = `${safeName}_${counter++}`;
        }
        
        nameMap[finalName] = customTool.action;
        toolDescriptions[finalName] = customTool.description;
        usedSanitizedNames.add(finalName);
        
        // Store parameter overrides if provided
        if (customTool.params) {
          paramOverrides[finalName] = customTool.params;
        }
        
        // Process schema for custom tool
        const paramsSchema = action?.definition?.params || action.action?.params || {};
        const zodSchemaProps = convertToZodSchemaProps(paramsSchema);
        
        // If there are parameter overrides, make those parameters optional in the schema
        // since they will be filled automatically
        if (customTool.params) {
          for (const overrideKey of Object.keys(customTool.params)) {
            if (zodSchemaProps[overrideKey]) {
              zodSchemaProps[overrideKey] = zodSchemaProps[overrideKey].optional();
            }
          }
        }
        
        actionSchemaShapes[finalName] = zodSchemaProps;
        
        // Process required keys (excluding overridden parameters)
        const requiredKeys: string[] = [];
        if (typeof paramsSchema === 'object' && paramsSchema !== null) {
          for (const [key, propSchema] of Object.entries(paramsSchema)) {
            if (key === '$$strict' || key === '$$async') continue;
            
            // Skip if this parameter is overridden
            if (customTool.params && customTool.params.hasOwnProperty(key)) {
              continue;
            }
            
            const isRequired = typeof propSchema === 'object' && propSchema !== null 
              ? !(propSchema.optional === true) 
              : true;
              
            if (isRequired) {
              requiredKeys.push(key);
            }
          }
        }
        requiredKeysMap[finalName] = requiredKeys;
      } else {
        console.warn(`Custom tool references non-existent or not allowed action: ${customTool.action}`);
      }
    });
  }
  
  // Then process remaining allowed actions that don't have custom tools
  allowedActions.forEach(action => {
    const originalName = action.name;
    
    // Skip if this action already has a custom tool
    const hasCustomTool = settings.tools?.some(tool => tool.action === originalName);
    if (hasCustomTool) {
      return;
    }
    
    // Apply naming rules: if the name contains anything but ASCII letters, digits or underscores,
    // replace invalid runs with "_", lower-case, trim, and append a numeric suffix on collision
    const safeName = sanitizeActionName(originalName);
    
    // Build the name mapping
    nameMap[safeName] = originalName;
    toolDescriptions[safeName] = generateToolDescription(originalName);
    
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
        const toolDescription = toolDescriptions[safeName] || generateToolDescription(originalName);
        const zodSchemaShape = actionSchemaShapes[safeName];
        
        // Register tool with simpler approach - remove structuredContent to avoid errors
        server.tool(
          safeName, 
          toolDescription, 
          zodSchemaShape, 
          async (args) => {
            try {
              // Merge user-provided args with parameter overrides
              const finalArgs = { ...args };
              
              // Apply parameter overrides if they exist for this tool
              if (paramOverrides[safeName]) {
                Object.assign(finalArgs, paramOverrides[safeName]);
                console.log(`Applied parameter overrides for '${safeName}':`, paramOverrides[safeName]);
              }
              
              // Forward request to Moleculer using the original action name
              console.log(`MCP tool '${safeName}' calling action '${originalName}' with args:`, finalArgs);
              const result = await broker.call(originalName, finalArgs);
              
              // Only return content, no structuredContent to avoid the error
              return {
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
    console.log(`Exposed ${Object.keys(nameMap).length} Moleculer actions as MCP tools`);
    console.log(`Settings:`, JSON.stringify(settings, null, 2));
  });
}

main().catch(console.error);