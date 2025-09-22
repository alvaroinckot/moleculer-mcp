import { z } from "zod";
import { BridgeBroker, ActionInfo } from "../broker/BridgeBroker";
import { BridgeOptions } from "../config/BridgeOptions";
import { NameSanitizer } from "./NameSanitizer";
import { SchemaFactory } from "./SchemaFactory";

export interface ToolConfig {
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: any) => Promise<any>;
}

export class ServiceCatalogue {
  private nameMap: Record<string, string> = {};
  private toolConfigs: Record<string, ToolConfig> = {};
  private usedNames = new Set<string>();

  constructor(
    private readonly broker: BridgeBroker,
    private readonly options: BridgeOptions
  ) {
    this.buildCatalogue();
  }

  private buildCatalogue(): void {
    const actions = this.broker.listActions();
    const allowedActions = this.filterAllowedActions(actions);

    console.log(
      `Found ${actions.length} total actions, ${allowedActions.length} allowed by settings`
    );

    // First, process custom tools from settings
    this.processCustomTools(allowedActions);

    // Then process remaining allowed actions that don't have custom tools
    this.processRemainingActions(allowedActions);
  }

  private filterAllowedActions(actions: ActionInfo[]): ActionInfo[] {
    return actions.filter((action) => this.isActionAllowed(action.name, this.options.allow));
  }

  private isActionAllowed(actionName: string, allowPatterns: readonly string[]): boolean {
    return allowPatterns.some((pattern) => {
      if (pattern === "*") {
        return true;
      }

      if (pattern.endsWith("*")) {
        // Wildcard pattern like "posts.*"
        const prefix = pattern.slice(0, -1);
        return actionName.startsWith(prefix);
      }

      // Exact match
      return actionName === pattern;
    });
  }

  private processCustomTools(allowedActions: ActionInfo[]): void {
    for (const customTool of this.options.tools) {
      const action = allowedActions.find((a) => a.name === customTool.action);
      if (!action) {
        console.warn(
          `Custom tool references non-existent or not allowed action: ${customTool.action}`
        );
        continue;
      }

      const safeName = NameSanitizer.stripForbidden(customTool.name);
      const finalName = NameSanitizer.ensureUnique(safeName, this.usedNames);

      this.nameMap[finalName] = customTool.action;
      this.usedNames.add(finalName);

      this.createToolConfig(finalName, action, customTool.description, customTool.params);
    }
  }

  private processRemainingActions(allowedActions: ActionInfo[]): void {
    for (const action of allowedActions) {
      const originalName = action.name;

      // Skip if this action already has a custom tool
      const hasCustomTool = this.options.tools.some((tool) => tool.action === originalName);
      if (hasCustomTool) {
        continue;
      }

      const safeName = NameSanitizer.sanitizeActionName(originalName);
      const finalName = NameSanitizer.ensureUnique(safeName, this.usedNames);

      this.nameMap[finalName] = originalName;
      this.usedNames.add(finalName);

      const description = this.generateToolDescription(originalName);
      this.createToolConfig(finalName, action, description);
    }
  }

  private createToolConfig(
    toolName: string,
    action: ActionInfo,
    description: string,
    paramOverrides?: Record<string, any>
  ): void {
    const paramsSchema = action?.definition?.params || action.action?.params || {};
    let zodSchema = SchemaFactory.build(paramsSchema);

    // If there are parameter overrides, make those parameters optional in the schema
    if (paramOverrides && zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      const newShape: Record<string, z.ZodTypeAny> = {};

      for (const [key, value] of Object.entries(shape)) {
        if (
          Object.prototype.hasOwnProperty.call(paramOverrides, key) &&
          value &&
          typeof value === "object" &&
          "optional" in value
        ) {
          newShape[key] = (value as z.ZodTypeAny).optional();
        } else {
          newShape[key] = value as z.ZodTypeAny;
        }
      }

      zodSchema = z.object(newShape);
    }

    const originalActionName = this.nameMap[toolName];

    this.toolConfigs[toolName] = {
      description,
      schema: zodSchema instanceof z.ZodObject ? zodSchema.shape : {},
      handler: async (args: any) => {
        try {
          // Merge user-provided args with parameter overrides
          const finalArgs = { ...args };

          // Apply parameter overrides if they exist for this tool
          if (paramOverrides) {
            Object.assign(finalArgs, paramOverrides);
            console.log(`Applied parameter overrides for '${toolName}':`, paramOverrides);
          }

          // Forward request to Moleculer using the original action name
          console.log(
            `MCP tool '${toolName}' calling action '${originalActionName}' with args:`,
            finalArgs
          );
          if (!originalActionName) {
            throw new Error(`No action mapping found for tool '${toolName}'`);
          }
          const result = await this.broker.call(originalActionName, finalArgs);

          // Only return content, no structuredContent to avoid errors
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
          };
        } catch (error) {
          console.error(`Error calling ${originalActionName}:`, error);
          throw error;
        }
      },
    };
  }

  private generateToolDescription(actionName: string): string {
    // Special handling for system actions
    if (actionName.startsWith("$node.")) {
      const actionPart = actionName.replace("$node.", "");
      return `Get ${actionPart} information from the Moleculer node`;
    }

    // Handle other common patterns
    if (actionName.includes(".")) {
      const parts = actionName.split(".");
      const service = parts[0];
      const method = parts[parts.length - 1];
      if (method) {
        return `${method.charAt(0).toUpperCase() + method.slice(1)} operation for the ${service} service`;
      }
    }

    // Generic fallback
    return `Execute the ${actionName} action`;
  }

  getTools(): Record<string, ToolConfig> {
    return { ...this.toolConfigs };
  }
}
