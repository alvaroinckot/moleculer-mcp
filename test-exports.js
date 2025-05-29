// Test the exports manually
const path = require('path');

console.log('Testing direct imports...');

try {
  const BridgeOptions = require('./dist/cjs/config/BridgeOptions.js');
  console.log('✓ BridgeOptions:', Object.keys(BridgeOptions));
} catch (e) {
  console.error('✗ BridgeOptions:', e.message);
}

try {
  const McpBridgeService = require('./dist/cjs/service/McpBridgeService.js');
  console.log('✓ McpBridgeService:', Object.keys(McpBridgeService));
} catch (e) {
  console.error('✗ McpBridgeService:', e.message);
}

try {
  const index = require('./dist/cjs/index.js');
  console.log('✓ index:', Object.keys(index));
} catch (e) {
  console.error('✗ index:', e.message);
}
