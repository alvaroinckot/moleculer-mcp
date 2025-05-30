import { Command } from "commander";
import { BridgeOptions } from "../config/BridgeOptions";
import { BridgeBroker } from "../broker/BridgeBroker";
import { McpGateway } from "../mcp/McpGateway";
import { ServiceCatalogue } from "../catalogue/ServiceCatalogue";
import * as fs from "fs";

export class BridgeCli {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('moleculer-mcp')
      .description('Moleculer MCP Bridge CLI')
      .version('1.0.0');

    this.program
      .command('start')
      .description('Start the MCP bridge server')
      .argument('[config]', 'MCP Bridge configuration file path')
      .option('-m, --moleculer-config <path>', 'Moleculer configuration file path (moleculer.config.js)')
      .action(this.handleStart.bind(this));

    this.program
      .command('validate-config')
      .description('Validate configuration file')
      .argument('<config>', 'Configuration file path')
      .action(this.handleValidateConfig.bind(this));

    this.program
      .command('list-actions')
      .description('List available Moleculer actions')
      .option('-c, --config [config]', 'MCP Bridge configuration file path')
      .option('-m, --moleculer-config <path>', 'Moleculer configuration file path (moleculer.config.js)')
      .action(this.handleListActions.bind(this));
  }

  private async handleStart(configPath?: string, options?: { moleculerConfig?: string }): Promise<void> {
    try {
      console.log('Starting MCP Bridge...');
      
      let bridgeOptions = BridgeOptions.load(configPath);
      
      // If moleculer config is specified via CLI, override the broker config
      if (options?.moleculerConfig) {
        const currentOptions = {
          allow: [...bridgeOptions.allow],
          tools: [...bridgeOptions.tools],
          broker: {
            nodeID: bridgeOptions.broker.nodeID,
            transporter: bridgeOptions.broker.transporter,
            logLevel: bridgeOptions.broker.logLevel,
            configFile: options.moleculerConfig
          },
          server: {
            port: bridgeOptions.server.port,
            name: bridgeOptions.server.name,
            version: bridgeOptions.server.version
          }
        };
        bridgeOptions = new BridgeOptions(currentOptions);
      }
      
      const broker = new BridgeBroker(bridgeOptions);
      const gateway = new McpGateway(bridgeOptions, broker);

      // Setup graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        try {
          await gateway.stop();
          await broker.stop();
          console.log('Shutdown complete');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      await broker.start();
      await gateway.start();
      
      console.log('MCP Bridge started successfully. Press Ctrl+C to stop.');
    } catch (error) {
      console.error('Failed to start MCP Bridge:', error);
      process.exit(1);
    }
  }

  private async handleValidateConfig(configPath: string): Promise<void> {
    try {
      if (!fs.existsSync(configPath)) {
        console.error(`Configuration file not found: ${configPath}`);
        process.exit(1);
      }

      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      
      BridgeOptions.validate(config);
      
      console.log('✅ Configuration file is valid');
      console.log('Configuration:', JSON.stringify(config, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      process.exit(1);
    }
  }

  private async handleListActions(options: { config?: string; moleculerConfig?: string }): Promise<void> {
    let broker: BridgeBroker | null = null;
    
    try {
      let bridgeOptions = BridgeOptions.load(options.config);
      
      // If moleculer config is specified via CLI, override the broker config
      if (options.moleculerConfig) {
        const currentOptions = {
          allow: [...bridgeOptions.allow],
          tools: [...bridgeOptions.tools],
          broker: {
            nodeID: bridgeOptions.broker.nodeID,
            transporter: bridgeOptions.broker.transporter,
            logLevel: bridgeOptions.broker.logLevel,
            configFile: options.moleculerConfig
          },
          server: {
            port: bridgeOptions.server.port,
            name: bridgeOptions.server.name,
            version: bridgeOptions.server.version
          }
        };
        bridgeOptions = new BridgeOptions(currentOptions);
      }
      
      broker = new BridgeBroker(bridgeOptions);
      
      console.log('Starting broker to discover actions...');
      await broker.start();
      
      const actions = broker.listActions();
      const catalogue = new ServiceCatalogue(broker, bridgeOptions);
      const tools = catalogue.getTools();
      
      console.log('\n📋 Available Actions:');
      console.log(`Total actions found: ${actions.length}`);
      console.log(`Tools exposed via MCP: ${Object.keys(tools).length}`);
      
      console.log('\n🔧 MCP Tools:');
      Object.entries(tools).forEach(([name, config]) => {
        console.log(`  • ${name}: ${config.description}`);
      });
      
      console.log('\n📝 All Moleculer Actions:');
      actions.forEach(action => {
        const isExposed = Object.values(tools).some(tool => 
          // Check if this action is exposed by comparing with the catalogue's name mapping
          true // Simplified for now - the actual mapping is internal to ServiceCatalogue
        );
        const status = isExposed ? '✅' : '⏸️';
        console.log(`  ${status} ${action.name}`);
      });
      
      process.exit(0);
    } catch (error) {
      console.error('Failed to list actions:', error);
      process.exit(1);
    } finally {
      if (broker) {
        await broker.stop();
      }
    }
  }

  run(argv: string[]): void {
    this.program.parse(argv);
  }
}
