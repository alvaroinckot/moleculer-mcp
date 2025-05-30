describe("McpGateway", () => {
  it("should be importable", () => {
    const { McpGateway } = require("../src/mcp/McpGateway");
    expect(McpGateway).toBeDefined();
  });
});
