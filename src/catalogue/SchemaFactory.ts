import { z } from "zod";

export class SchemaFactory {
  static build(params: any): z.ZodTypeAny {
    if (!params) {
      return z.object({});
    }

    const schemaProps = this.convertToZodSchemaProps(params);
    return z.object(schemaProps);
  }

  private static convertToZodSchemaProps(schema: any): Record<string, z.ZodTypeAny> {
    if (!schema) return {};

    const result: Record<string, z.ZodTypeAny> = {};

    if (typeof schema === "object" && !Array.isArray(schema)) {
      // Extract properties from the schema object
      const props = schema.props || schema;

      for (const [key, propSchema] of Object.entries(props)) {
        if (key === "$$strict" || key === "$$async") continue;

        let zodProp: z.ZodTypeAny;

        // Handle different types
        if (typeof propSchema === "string") {
          zodProp = this.convertStringType(propSchema);
        } else if (Array.isArray(propSchema)) {
          zodProp = this.convertArrayType(propSchema);
        } else if (typeof propSchema === "object" && propSchema !== null) {
          zodProp = this.convertObjectType(propSchema);
        } else {
          // Default for unrecognized types
          zodProp = z.any();
        }

        result[key] = zodProp;
      }
    }

    return result;
  }

  private static convertStringType(propSchema: string): z.ZodTypeAny {
    switch (propSchema) {
      case "string":
        return z.string();
      case "number":
        return z.number();
      case "boolean":
        return z.boolean();
      case "date":
        return z.date();
      case "email":
        return z.string().email();
      case "url":
        return z.string().url();
      case "uuid":
        return z.string().uuid();
      default:
        return z.any();
    }
  }

  private static convertArrayType(propSchema: any[]): z.ZodTypeAny {
    if (propSchema.length === 0) {
      return z.array(z.any());
    } else {
      // Use first item as array type
      const itemProps = this.convertToZodSchemaProps({ item: propSchema[0] });
      return z.array(itemProps.item || z.any());
    }
  }

  private static convertObjectType(propSchema: any): z.ZodTypeAny {
    if (propSchema && "type" in propSchema && propSchema.type === "array") {
      if ("items" in propSchema && propSchema.items) {
        const itemProps = this.convertToZodSchemaProps({ item: propSchema.items });
        return z.array(itemProps.item || z.any());
      } else {
        return z.array(z.any());
      }
    } else if (
      (propSchema && "type" in propSchema && propSchema.type === "object") ||
      (propSchema && "props" in propSchema)
    ) {
      // Nested object
      const nestedProps = this.convertToZodSchemaProps(propSchema);
      return z.object(nestedProps);
    } else if (propSchema && "type" in propSchema) {
      // Simple type with definition
      const zodType = this.convertStringType(propSchema.type);

      // Handle optional flag
      if (propSchema.optional === true) {
        return zodType.optional();
      }

      return zodType;
    } else {
      // Fallback for other object definitions
      const nestedProps = this.convertToZodSchemaProps(propSchema);

      // If no properties found, return z.any()
      if (Object.keys(nestedProps).length === 0) {
        return z.any();
      }

      const zodType = z.object(nestedProps);

      // Handle optional flag
      if (propSchema.optional === true) {
        return zodType.optional();
      }

      return zodType;
    }
  }
}
