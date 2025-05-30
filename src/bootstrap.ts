import { BridgeOptions } from "./config/BridgeOptions";
import { BridgeBroker } from "./broker/BridgeBroker";
import { McpGateway } from "./mcp/McpGateway";
import { BridgeCli } from "./cli/BridgeCli";

async function main(): Promise<void> {
  // Check for command line argument --settings or --config for backwards compatibility
  const args = process.argv.slice(2);
  const settingsIndex = args.findIndex(arg => arg === '--settings' || arg === '--config');
  
  if (settingsIndex !== -1 && args[settingsIndex + 1]) {
    // Legacy mode: load config from command line argument
    const configPath = args[settingsIndex + 1];
    
    try {
      console.log('Starting in standalone mode...');
      
      const options = BridgeOptions.load(configPath);
      const broker = new BridgeBroker(options);
      const gateway = new McpGateway(options, broker);

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
  } else {
    // New CLI mode
    const cli = new BridgeCli();
    cli.run(process.argv);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
