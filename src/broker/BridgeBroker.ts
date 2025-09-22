import { ServiceBroker } from "moleculer";
import { ActionSchema } from "moleculer";
import { BridgeOptions } from "../config/BridgeOptions";
import * as fs from "fs";
import * as path from "path";

export interface ActionInfo {
  name: string;
  action?: ActionSchema;
  definition?: {
    params?: Record<string, any>;
  };
}

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

export class BridgeBroker {
  private broker: ServiceBroker;
  private isStarted = false;

  constructor(private readonly options: BridgeOptions) {
    this.broker = this.createBroker();
  }

  private createBroker(): ServiceBroker {
    // If a Moleculer config file is specified, load it
    if (this.options.broker.configFile) {
      const configPath = path.resolve(this.options.broker.configFile);

      if (!fs.existsSync(configPath)) {
        throw new BridgeError(`Moleculer config file not found: ${configPath}`);
      }

      try {
        // Clear require cache to ensure fresh load
        delete require.cache[require.resolve(configPath)];

        // Load the Moleculer config
        const moleculerConfig = require(configPath);

        // Use the loaded config, but allow our options to override specific settings
        const brokerConfig = {
          ...moleculerConfig,
          nodeID: this.options.broker.nodeID,
          logLevel: this.options.broker.logLevel,
          // Only override transporter if it's not specified in the moleculer config
          ...(moleculerConfig.transporter === undefined && {
            transporter: this.options.broker.transporter,
          }),
        };

        console.log(`Loading Moleculer broker with config from: ${configPath}`);
        return new ServiceBroker(brokerConfig);
      } catch (error) {
        throw new BridgeError(`Failed to load Moleculer config file: ${error}`);
      }
    }

    // Default configuration when no config file is specified
    return new ServiceBroker({
      nodeID: this.options.broker.nodeID,
      transporter: this.options.broker.transporter,
      logLevel: this.options.broker.logLevel as any,
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new BridgeError("Broker is already started");
    }

    try {
      await this.broker.start();

      // Wait for service discovery
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.isStarted = true;
    } catch (error) {
      throw new BridgeError(`Failed to start broker: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      await this.broker.stop();
      this.isStarted = false;
    } catch (error) {
      throw new BridgeError(`Failed to stop broker: ${error}`);
    }
  }

  listActions(): ActionInfo[] {
    if (!this.isStarted) {
      throw new BridgeError("Broker is not started");
    }

    return this.broker.registry.getActionList({ withEndpoints: false }) as unknown as ActionInfo[];
  }

  async call(actionName: string, params: any): Promise<any> {
    if (!this.isStarted) {
      throw new BridgeError("Broker is not started");
    }

    try {
      return await this.broker.call(actionName, params);
    } catch (error) {
      throw new BridgeError(`Failed to call action ${actionName}: ${error}`);
    }
  }

  get isRunning(): boolean {
    return this.isStarted;
  }
}
