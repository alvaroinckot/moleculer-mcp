# moleculer-mcp

> A Model Context Protocol (MCP) server that exposes [Moleculer.js](https://github.com/moleculerjs/moleculer) actions as AI tools.

![Moleculer MCP in action.](docs/image.png)

## 📋 Overview

Moleculer-MCP acts as a bridge between the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) and [Moleculer.js](https://github.com/moleculerjs/moleculer) microservices. It automatically exposes all your Moleculer service actions as MCP tools, enabling AI agents to seamlessly interact with your Moleculer services.

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

# Option 1: Start with default settings (allow all actions)
npm start

# Option 2: Start with example settings file
npm run start:example

# Option 3: Use command line arguments
node dist/index.js --settings settings.example.json
node dist/index.js --config my-custom-settings.json

# Option 4: Use the convenient start script
./start.sh --example                    # Use settings.example.json
./start.sh --file my-settings.json     # Use custom settings file  
./start.sh --env                       # Use MCP_BRIDGE_SETTINGS env variable
./start.sh --default                   # Use default settings

# Option 5: Environment variable (legacy support)
export MCP_BRIDGE_SETTINGS=$(cat settings.example.json)
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

### Basic Configuration

The server is configured to connect to a NATS server for Moleculer service transport. You can modify this in the `src/index.ts` file:

```typescript
const broker = new ServiceBroker({
  nodeID: "mcp-bridge",
  transporter: "NATS", // Configure your transporter here
});
```

### Advanced Configuration with Settings

You can configure the bridge behavior using:

1. **Command line arguments** (recommended):
   ```bash
   node dist/index.js --settings settings.json
   node dist/index.js --config my-config.json
   ```

2. **Environment variable** (legacy support):
   ```bash
   export MCP_BRIDGE_SETTINGS='{"allow":["*"]}'
   ```

This allows you to:

- Control which Moleculer actions are exposed as MCP tools
- Customize tool names and descriptions
- Use wildcard patterns for bulk permissions

#### Settings Format

```json
{
  "allow": [
    "*",           // Allow all actions (wildcard)
    "posts.*",     // Allow any actions in 'posts' service
    "users.list"   // Allow only the specific 'users.list' action
  ],
  "tools": [
    {
      "name": "user_list_custom_tool_name",
      "action": "users.list", 
      "description": "List all users in the system"
    }
  ]
}
```

#### Configuration Options

**`allow` Array**: Controls which Moleculer actions are exposed as MCP tools
- `"*"` - Wildcard that allows all actions
- `"service.*"` - Allows all actions within a specific service
- `"service.action"` - Allows only a specific action

**`tools` Array**: Defines custom tool names and descriptions
- `name` - Custom name for the MCP tool (must match `/^[A-Za-z0-9_]{1,64}$/`)
- `action` - The Moleculer action to call
- `description` - Custom description for the tool
- `params` - (Optional) Default parameter values that will be automatically applied to the action

#### Parameter Overrides

The `params` field in custom tools allows you to:
- Set default values for action parameters
- Hide complexity from AI agents by pre-configuring common parameters
- Create specialized versions of generic actions
- Override required parameters to make them optional for the MCP tool

When a parameter is overridden:
1. The overridden parameter becomes optional in the MCP tool schema
2. The override value is automatically merged with user-provided arguments
3. User-provided values take precedence over overrides (if the parameter is still exposed)

#### Example Usage

```bash
# Set restrictive permissions with custom tool names and parameter overrides
export MCP_BRIDGE_SETTINGS='{
  "allow": ["users.list", "users.get", "posts.*"],
  "tools": [
    {
      "name": "get_user_list",
      "action": "users.list",
      "description": "Retrieve a list of all registered users"
    },
    {
      "name": "get_user_details", 
      "action": "users.get",
      "description": "Get detailed information about a specific user"
    },
    {
      "name": "get_featured_posts",
      "action": "posts.list",
      "description": "Get only featured blog posts",
      "params": {
        "featured": true,
        "status": "published",
        "limit": 20
      }
    },
    {
      "name": "get_users_paginated",
      "action": "users.list", 
      "description": "Get users with default pagination",
      "params": {
        "limit": 10,
        "offset": 0,
        "sort": "created_at"
      }
    }
  ]
}'

npm start
```

If no `MCP_BRIDGE_SETTINGS` is provided, the bridge defaults to allowing all actions (`["*"]`) with auto-generated tool names and descriptions.

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
