#!/usr/bin/env node
// MCP server stdio per TavoloLibero: espone i 3 tool compliance.
// Registrato in .mcp.json alla root del progetto.

require('dotenv').config();

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const tools = [
  require('./tools/check-fornero-compliance'),
  require('./tools/simulate-tax-benefits'),
  require('./tools/validate-marketplace-legal-docs')
];

const registry = new Map(tools.map(t => [t.schema.name, t]));

const server = new Server(
  { name: 'tavolibero-compliance', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => t.schema)
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = registry.get(request.params.name);
  if (!tool) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'unknown_tool', name: request.params.name }) }], isError: true };
  }
  const result = await tool.run(request.params.arguments || {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('tavolibero-compliance MCP server connesso (stdio)');
}

main().catch(err => {
  console.error('MCP server fatal:', err);
  process.exit(1);
});
