# moleculer-mcp

> A Model Context Protocol (MCP) server that exposes [Moleculer.js](https://github.com/moleculerjs/moleculer) actions as AI tools.

![Moleculer MCP in action.](docs/image.png)

## 📋 Overview

Moleculer-MCP acts as a bridge between the [Model Context Protocol (MCP)](https://github.com/Azure/model-context-protocol) and [Moleculer.js](https://github.com/moleculerjs/moleculer) microservices. It automatically exposes all your Moleculer service actions as MCP tools, enabling AI agents to seamlessly interact with your Moleculer services.

### Key Features

- **Automatic Conversion**: Transforms Moleculer service actions into MCP-compatible tools
- **Schema Mapping**: Automatically converts Moleculer's validation schemas to Zod schemas for MCP
- **Real-time Discovery**: Dynamically discovers and exposes all available Moleculer actions
- **Express Integration**: Uses Express.js for HTTP transport
- **NATS Transport**: Uses NATS for Moleculer service communication (configurable)
- **Dockerized**: Ready for containerized deployment

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or later
- NATS server (for Moleculer transport)
- Moleculer services to expose

### Installation

```bash
# Clone this repository
git clone https://github.com/alvaroinckot/moleculer-mcp.git
cd moleculer-mcp

# Install dependencies
npm install
```

### Running Locally

```bash
# Build the TypeScript code
npm run build

# Start the server
npm start
```

The server will start on port 3000 by default and expose endpoints at:
- http://localhost:3000/ 
- http://localhost:3000/v1/mcp

### Docker Deployment

```bash
# Build the Docker image
docker build -t moleculer-mcp .

# Run the container
docker run -p 3000:3000 moleculer-mcp
```

## 🛠️ Configuration

The server is configured to connect to a NATS server for Moleculer service transport. You can modify this in the `src/index.ts` file:

```typescript
const broker = new ServiceBroker({
  nodeID: "mcp-bridge",
  transporter: "NATS", // Configure your transporter here
});
```

## 🔍 How It Works

1. The server starts a Moleculer broker and connects to the NATS transporter
2. It discovers all available Moleculer service actions
3. Each action is converted to an MCP-compatible tool:
   - Action names are sanitized to match MCP naming requirements
   - Parameter schemas are converted from Moleculer format to Zod schemas
   - Tool descriptions are generated automatically from action names
4. The server exposes an MCP-compatible endpoint that AI agents can communicate with
5. When an AI calls a tool, the request is forwarded to the corresponding Moleculer action

## 📦 Project Structure

```
moleculer-mcp/
├── src/
│   └── index.ts       # Main application code
├── Dockerfile         # Docker configuration
├── package.json       # Project dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md          # Project documentation
```

## ⚙️ API

### MCP Endpoint

The MCP server is exposed at `http://localhost:3000/` and `http://localhost:3000/v1/mcp`.

### Tool Generation

Moleculer actions are exposed as MCP tools with the following transformations:

- Action names are sanitized to match `/^[A-Za-z0-9_]{1,64}$/`
- Service-specific naming patterns are preserved (e.g., `$node.health` becomes `f1e__node_health`)
- Parameter schemas are converted to Zod schemas
- Required parameters are preserved

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
