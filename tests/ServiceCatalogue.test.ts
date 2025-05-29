import { ServiceCatalogue } from "../src/catalogue/ServiceCatalogue";
import { BridgeBroker, ActionInfo } from "../src/broker/BridgeBroker";
import { BridgeOptions } from "../src/config/BridgeOptions";

// Mock dependencies
jest.mock("../src/broker/BridgeBroker");

describe("ServiceCatalogue", () => {
  let catalogue: ServiceCatalogue;
  let mockBroker: jest.Mocked<BridgeBroker>;
  let options: BridgeOptions;
  let mockActions: ActionInfo[];

  beforeEach(() => {
    mockActions = [
      { name: "users.list", action: { params: { limit: "number" } } },
      { name: "users.get", action: { params: { id: "string" } } },
      { name: "posts.create", action: { params: { title: "string", body: "string" } } },
      { name: "$node.health", action: { params: {} } },
      { name: "internal.private", action: { params: {} } },
    ];

    mockBroker = {
      listActions: jest.fn().mockReturnValue(mockActions),
      call: jest.fn(),
    } as any;

    options = new BridgeOptions({
      allow: ["users.*", "$node.health"],
      tools: [
        {
          name: "get_user_list",
          action: "users.list",
          description: "Get all users with pagination",
          params: { limit: 10 }
        }
      ]
    });
  });

  describe("constructor", () => {
    it("should build catalogue from allowed actions", () => {
      catalogue = new ServiceCatalogue(mockBroker, options);
      
      expect(mockBroker.listActions).toHaveBeenCalled();
      
      const tools = catalogue.getTools();
      expect(Object.keys(tools)).toContain("get_user_list"); // Custom tool
      expect(Object.keys(tools)).toContain("users_get"); // Auto-generated tool
      expect(Object.keys(tools)).toContain("node_health"); // System action
      expect(Object.keys(tools)).not.toContain("posts_create"); // Not allowed
      expect(Object.keys(tools)).not.toContain("internal_private"); // Not allowed
    });
  });

  describe("getTools", () => {
    beforeEach(() => {
      catalogue = new ServiceCatalogue(mockBroker, options);
    });

    it("should return tool configurations", () => {
      const tools = catalogue.getTools();
      
      expect(tools).toBeInstanceOf(Object);
      expect(Object.keys(tools).length).toBeGreaterThan(0);
      
      // Check custom tool
      const getUserListTool = tools["get_user_list"];
      expect(getUserListTool).toBeDefined();
      expect(getUserListTool?.description).toBe("Get all users with pagination");
    });

    it("should have proper tool structure", () => {
      const tools = catalogue.getTools();
      
      for (const [name, tool] of Object.entries(tools)) {
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("schema");
        expect(tool).toHaveProperty("handler");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.schema).toBe("object");
        expect(typeof tool.handler).toBe("function");
      }
    });
  });

  describe("action filtering", () => {
    it("should allow wildcard patterns", () => {
      const wildcardOptions = new BridgeOptions({ allow: ["*"] });
      catalogue = new ServiceCatalogue(mockBroker, wildcardOptions);
      
      const tools = catalogue.getTools();
      expect(Object.keys(tools).length).toBe(mockActions.length);
    });

    it("should allow service-specific patterns", () => {
      const serviceOptions = new BridgeOptions({ allow: ["users.*"] });
      catalogue = new ServiceCatalogue(mockBroker, serviceOptions);
      
      const tools = catalogue.getTools();
      const toolNames = Object.keys(tools);
      
      expect(toolNames.some(name => name.includes("users"))).toBe(true);
      expect(toolNames.some(name => name.includes("posts"))).toBe(false);
    });

    it("should allow exact action matches", () => {
      const exactOptions = new BridgeOptions({ allow: ["users.list"] });
      catalogue = new ServiceCatalogue(mockBroker, exactOptions);
      
      const tools = catalogue.getTools();
      expect(Object.keys(tools)).toHaveLength(1);
      expect(Object.keys(tools)[0]).toMatch(/users.*list/);
    });
  });

  describe("tool handlers", () => {
    beforeEach(() => {
      catalogue = new ServiceCatalogue(mockBroker, options);
    });

    it("should call broker with correct parameters", async () => {
      mockBroker.call.mockResolvedValue({ success: true, data: [] });
      
      const tools = catalogue.getTools();
      const usersTool = tools["users_get"];
      
      if (!usersTool) {
        throw new Error("Tool not found");
      }
      
      await usersTool.handler({ id: "123" });
      
      expect(mockBroker.call).toHaveBeenCalledWith("users.get", { id: "123" });
    });

    it("should apply parameter overrides for custom tools", async () => {
      mockBroker.call.mockResolvedValue({ success: true, data: [] });
      
      const tools = catalogue.getTools();
      const customTool = tools["get_user_list"];
      
      if (!customTool) {
        throw new Error("Tool not found");
      }
      
      await customTool.handler({ offset: 20 });
      
      // Should merge user params with overrides
      expect(mockBroker.call).toHaveBeenCalledWith("users.list", { 
        offset: 20,
        limit: 10 // From override
      });
    });

    it("should return formatted response", async () => {
      const mockResult = { users: [{ id: 1, name: "John" }] };
      mockBroker.call.mockResolvedValue(mockResult);
      
      const tools = catalogue.getTools();
      const usersTool = tools["users_get"];
      
      if (!usersTool) {
        throw new Error("Tool not found");
      }
      
      const response = await usersTool.handler({ id: "123" });
      
      expect(response).toEqual({
        content: [{ type: "text", text: JSON.stringify(mockResult) }]
      });
    });

    it("should handle errors properly", async () => {
      const error = new Error("Service unavailable");
      mockBroker.call.mockRejectedValue(error);
      
      const tools = catalogue.getTools();
      const usersTool = tools["users_get"];
      
      if (!usersTool) {
        throw new Error("Tool not found");
      }
      
      await expect(usersTool.handler({ id: "123" })).rejects.toThrow("Service unavailable");
    });
  });

  describe("name generation", () => {
    it("should generate descriptions for system actions", () => {
      const systemOptions = new BridgeOptions({ allow: ["$node.*"] });
      catalogue = new ServiceCatalogue(mockBroker, systemOptions);
      
      const tools = catalogue.getTools();
      const healthTool = Object.values(tools).find(tool => 
        tool.description.includes("health")
      );
      
      expect(healthTool).toBeDefined();
      expect(healthTool?.description).toMatch(/health.*node/i);
    });

    it("should generate descriptions for service actions", () => {
      const serviceOptions = new BridgeOptions({ allow: ["users.list"] });
      catalogue = new ServiceCatalogue(mockBroker, serviceOptions);
      
      const tools = catalogue.getTools();
      const listTool = Object.values(tools)[0];
      
      if (!listTool) {
        throw new Error("Tool not found");
      }
      
      expect(listTool.description).toMatch(/list.*users/i);
    });
  });
});
