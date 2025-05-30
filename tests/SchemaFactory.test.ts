import { SchemaFactory } from "../src/catalogue/SchemaFactory";
import { z } from "zod";

describe("SchemaFactory", () => {
  describe("build", () => {
    it("should return empty object schema for null/undefined params", () => {
      const schema1 = SchemaFactory.build(null);
      const schema2 = SchemaFactory.build(undefined);
      
      expect(schema1).toBeInstanceOf(z.ZodObject);
      expect(schema2).toBeInstanceOf(z.ZodObject);
    });

    it("should handle string type definitions", () => {
      const params = {
        name: "string",
        age: "number",
        active: "boolean",
        email: "email",
        website: "url",
        id: "uuid"
      };
      
      const schema = SchemaFactory.build(params);
      expect(schema).toBeInstanceOf(z.ZodObject);
      
      const shape = (schema as z.ZodObject<any>).shape;
      expect(shape.name).toBeInstanceOf(z.ZodString);
      expect(shape.age).toBeInstanceOf(z.ZodNumber);
      expect(shape.active).toBeInstanceOf(z.ZodBoolean);
    });

    it("should handle array type definitions", () => {
      const params = {
        tags: ["string"],
        numbers: ["number"],
        emptyArray: []
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.tags).toBeInstanceOf(z.ZodArray);
      expect(shape.numbers).toBeInstanceOf(z.ZodArray);
      expect(shape.emptyArray).toBeInstanceOf(z.ZodArray);
    });

    it("should handle object type definitions", () => {
      const params = {
        user: {
          type: "object",
          props: {
            name: "string",
            age: "number"
          }
        }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.user).toBeInstanceOf(z.ZodObject);
    });

    it("should handle array with items definition", () => {
      const params = {
        users: {
          type: "array",
          items: {
            type: "object",
            props: {
              name: "string"
            }
          }
        }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.users).toBeInstanceOf(z.ZodArray);
    });

    it("should handle optional fields", () => {
      const params = {
        required: "string",
        optional: {
          type: "string",
          optional: true
        }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.required).toBeInstanceOf(z.ZodString);
      expect(shape.optional).toBeInstanceOf(z.ZodOptional);
    });

    it("should handle nested objects", () => {
      const params = {
        address: {
          street: "string",
          city: "string",
          coordinates: {
            lat: "number",
            lng: "number"
          }
        }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.address).toBeInstanceOf(z.ZodObject);
    });

    it("should handle props structure", () => {
      const params = {
        props: {
          name: "string",
          age: "number"
        }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.name).toBeInstanceOf(z.ZodString);
      expect(shape.age).toBeInstanceOf(z.ZodNumber);
    });

    it("should skip special keys", () => {
      const params = {
        $$strict: true,
        $$async: true,
        name: "string"
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.$$strict).toBeUndefined();
      expect(shape.$$async).toBeUndefined();
      expect(shape.name).toBeInstanceOf(z.ZodString);
    });

    it("should fallback to z.any() for unrecognized types", () => {
      const params = {
        unknown: "unknowntype",
        complex: { someComplexStructure: true }
      };
      
      const schema = SchemaFactory.build(params);
      const shape = (schema as z.ZodObject<any>).shape;
      
      expect(shape.unknown).toBeInstanceOf(z.ZodAny);
    });
  });
});
