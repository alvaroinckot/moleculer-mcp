# Moleculer MCP Bridge

> A Model Context Protocol (MCP) server that exposes [Moleculer.js](https://github.com/moleculerjs/moleculer) actions as AI tools.

![Moleculer MCP in action.](docs/image.png)

## 📋 Overview

Moleculer-MCP acts as a bridge between the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) and [Moleculer.js](https://github.com/moleculerjs/moleculer) microservices. It automatically exposes all your Moleculer service actions as MCP tools, enabling AI agents to seamlessly interact with your Moleculer services.

## 🚀 Quick Start

### Installation

```bash
npm install -g moleculer-mcp
```

### Basic Usage

1. **Start with default settings** (connects to local NATS and exposes all actions):
   ```bash
   moleculer-mcp start
   ```

2. **Use your existing Moleculer configuration**:
   ```bash
   moleculer-mcp start -m ./moleculer.config.js
   ```

3. **Use a custom bridge configuration**:
   ```bash
   moleculer-mcp start config.json
   ```

4. **Combine both configurations**:
   ```bash
   moleculer-mcp start config.json -m ./moleculer.config.js
   ```

### Configuration

Create a `config.json` file to customize the bridge behavior:

```json
{
  "allow": ["users.*", "posts.*", "$node.health"],
  "server": {
    "port": 3000
  },
  "tools": [
    {
      "name": "get_user_list",
      "action": "users.list",
      "description": "Get paginated list of users",
      "params": { "limit": 50 }
    }
  ]
}
```

**Configuration Options:**
- `allow`: Array of action patterns to expose (supports wildcards like `"users.*"`)
- `server.port`: Port for the MCP server (default: 3000)
- `broker.configFile`: Path to your Moleculer config file
- `tools`: Custom tool definitions with parameter overrides

### CLI Commands

```bash
# Start the bridge
moleculer-mcp start [config.json] [-m moleculer.config.js]

# List available actions
moleculer-mcp list-actions [-c config.json] [-m moleculer.config.js]

# Validate configuration
moleculer-mcp validate-config config.json
```

### Integration with AI Clients

Once running, your Moleculer actions are available at:
- `http://localhost:3000/` (MCP endpoint)
- `http://localhost:3000/v1/mcp` (Alternative endpoint)

Configure your AI client (Claude Desktop, etc.) to use this endpoint as an MCP server.

## 📚 Example

If you have a Moleculer service like this:

```javascript
// user.service.js
module.exports = {
  name: "users",
  actions: {
    list: {
      params: { limit: "number", offset: "number" },
      handler(ctx) {
        return this.getUsers(ctx.params);
      }
    }
  }
};
```

The bridge automatically exposes it as an MCP tool that AI agents can call:

```json
{
  "name": "users_list",
  "description": "List operation for the users service",
  "parameters": {
    "limit": { "type": "number" },
    "offset": { "type": "number" }
  }
}
```

## 🔧 Advanced Usage

### Using with Docker

The project includes a production-ready Dockerfile with the latest Node.js LTS version, configurable ports, and support for custom configuration files.

#### Quick Start with Docker

```bash
# Build the image
docker build -t moleculer-mcp .

# Run with default settings (port 3000)
docker run -p 3000:3000 moleculer-mcp

# Run with custom port
docker run -p 8080:8080 -e PORT=8080 moleculer-mcp

# Run with custom settings file
docker run -p 3000:3000 \
  -v $(pwd)/my-settings.json:/app/my-settings.json \
  -e SETTINGS_FILE=/app/my-settings.json \
  moleculer-mcp
```

#### Using Docker Compose

```bash
# Copy the example environment file
cp .env.example .env

# Start with default configuration
docker-compose up

# Start with custom port (edit .env or use environment variables)
HOST_PORT=8080 CONTAINER_PORT=8080 docker-compose up

# Start with custom settings file
SETTINGS_FILE=/app/my-settings.json docker-compose up
```

#### Docker Environment Variables

- `PORT`: Port inside the container (default: 3000)
- `SETTINGS_FILE`: Path to custom settings file inside container (optional)

#### Volume Mounts

You can mount your configuration files:

```bash
docker run -p 3000:3000 \
  -v $(pwd)/moleculer.config.js:/app/moleculer.config.js:ro \
  -v $(pwd)/settings.json:/app/settings.json:ro \
  moleculer-mcp
```

### Environment Variables

Set configuration via environment variable:
```bash
export MCP_BRIDGE_SETTINGS='{"allow":["*"],"server":{"port":3000}}'
moleculer-mcp start
```

## 📖 Documentation

For detailed documentation, API reference, and advanced configuration options, visit our [documentation site](https://github.com/alvaroinckot/moleculer-mcp).

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
