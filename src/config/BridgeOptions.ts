import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export interface CustomTool {
  name: string;
  action: string;
  description: string;
  params?: Record<string, any>;
}

export interface Options {
  allow?: string[];
  tools?: CustomTool[];
  broker?: {
    nodeID?: string;
    transporter?: string;
    logLevel?: string;
  };
  server?: {
    port?: number;
    name?: string;
    version?: string;
  };
}

const CustomToolSchema = z.object({
  name: z.string(),
  action: z.string(),
  description: z.string(),
  params: z.record(z.any()).optional(),
});

const OptionsSchema = z.object({
  allow: z.array(z.string()).optional(),
  tools: z.array(CustomToolSchema).optional(),
  broker: z.object({
    nodeID: z.string().optional(),
    transporter: z.string().optional(),
    logLevel: z.string().optional(),
  }).optional(),
  server: z.object({
    port: z.number().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
}).strict();

type ValidatedOptions = z.infer<typeof OptionsSchema>;

export const DEFAULTS = {
  allow: ['*'] as const,
  tools: [] as const,
  broker: {
    nodeID: "mcp-bridge",
    transporter: "NATS",
    logLevel: "error",
  } as const,
  server: {
    port: 3000,
    name: "Moleculer-MCP-Bridge",
    version: "1.0.0",
  } as const,
} as const;

export class BridgeOptions {
  private readonly _allow: readonly string[];
  private readonly _tools: readonly CustomTool[];
  private readonly _broker: {
    readonly nodeID: string;
    readonly transporter: string;
    readonly logLevel: string;
  };
  private readonly _server: {
    readonly port: number;
    readonly name: string;
    readonly version: string;
  };

  constructor(options: Options) {
    const validated = OptionsSchema.parse(options);
    this._allow = Object.freeze([...(validated.allow ?? DEFAULTS.allow)]);
    
    // Handle tools with proper type mapping
    const mappedTools: CustomTool[] = (validated.tools ?? DEFAULTS.tools).map(tool => {
      const mappedTool: CustomTool = {
        name: tool.name,
        action: tool.action,
        description: tool.description,
      };
      if (tool.params !== undefined) {
        mappedTool.params = tool.params;
      }
      return mappedTool;
    });
    this._tools = Object.freeze(mappedTools);
    
    this._broker = Object.freeze({
      nodeID: validated.broker?.nodeID ?? DEFAULTS.broker.nodeID,
      transporter: validated.broker?.transporter ?? DEFAULTS.broker.transporter,
      logLevel: validated.broker?.logLevel ?? DEFAULTS.broker.logLevel,
    });
    this._server = Object.freeze({
      port: validated.server?.port ?? DEFAULTS.server.port,
      name: validated.server?.name ?? DEFAULTS.server.name,
      version: validated.server?.version ?? DEFAULTS.server.version,
    });
  }

  static load(configPath?: string): BridgeOptions {
    let options: Options = {};

    if (configPath) {
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        options = JSON.parse(content) as Options;
      } catch (error) {
        throw new Error(`Failed to parse configuration file: ${error}`);
      }
    }

    // Check environment variable fallback
    const envConfig = process.env.MCP_BRIDGE_SETTINGS;
    if (!configPath && envConfig) {
      try {
        options = JSON.parse(envConfig) as Options;
      } catch (error) {
        throw new Error(`Failed to parse MCP_BRIDGE_SETTINGS environment variable: ${error}`);
      }
    }

    return new BridgeOptions(options);
  }

  static validate(options: unknown): ValidatedOptions {
    return OptionsSchema.parse(options);
  }

  get allow(): readonly string[] {
    return this._allow;
  }

  get tools(): readonly CustomTool[] {
    return this._tools;
  }

  get broker(): {
    readonly nodeID: string;
    readonly transporter: string;
    readonly logLevel: string;
  } {
    return this._broker;
  }

  get server(): {
    readonly port: number;
    readonly name: string;
    readonly version: string;
  } {
    return this._server;
  }
}
