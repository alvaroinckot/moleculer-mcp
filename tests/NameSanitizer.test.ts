import { NameSanitizer } from "../src/catalogue/NameSanitizer";

describe("NameSanitizer", () => {
  describe("toSnake", () => {
    it("should convert camelCase to snake_case", () => {
      expect(NameSanitizer.toSnake("getUserData")).toBe("get_user_data");
      expect(NameSanitizer.toSnake("XMLHttpRequest")).toBe("xmlhttp_request");
    });

    it("should handle already snake_case strings", () => {
      expect(NameSanitizer.toSnake("user_data")).toBe("user_data");
    });

    it("should replace invalid characters", () => {
      expect(NameSanitizer.toSnake("get-user.data")).toBe("get_user_data");
    });
  });

  describe("stripForbidden", () => {
    it("should remove forbidden characters", () => {
      expect(NameSanitizer.stripForbidden("user@domain.com")).toBe("user_domain_com");
      expect(NameSanitizer.stripForbidden("test-action!")).toBe("test_action");
    });

    it("should collapse multiple underscores", () => {
      expect(NameSanitizer.stripForbidden("test___action")).toBe("test_action");
    });

    it("should remove leading and trailing underscores", () => {
      expect(NameSanitizer.stripForbidden("_test_action_")).toBe("test_action");
    });

    it("should handle empty string", () => {
      expect(NameSanitizer.stripForbidden("")).toBe("action");
      expect(NameSanitizer.stripForbidden("____")).toBe("action");
    });

    it("should truncate long names", () => {
      const longName = "a".repeat(100);
      const result = NameSanitizer.stripForbidden(longName);
      expect(result.length).toBe(64);
    });
  });

  describe("sanitizeActionName", () => {
    it("should sanitize action names correctly", () => {
      expect(NameSanitizer.sanitizeActionName("users.getById")).toBe("users_get_by_id");
      expect(NameSanitizer.sanitizeActionName("$node.health")).toBe("node_health");
    });

    it("should validate result matches pattern", () => {
      const result = NameSanitizer.sanitizeActionName("complex.action-name!");
      expect(result).toMatch(/^[A-Za-z0-9_]{1,64}$/);
    });

    it("should throw error for unsanitizable names", () => {
      // Mock stripForbidden to return invalid result for testing
      const originalStripForbidden = NameSanitizer.stripForbidden;
      jest.spyOn(NameSanitizer, 'stripForbidden').mockReturnValue('');
      
      expect(() => {
        NameSanitizer.sanitizeActionName("test");
      }).toThrow("Failed to sanitize action name");
      
      // Restore original method
      NameSanitizer.stripForbidden = originalStripForbidden;
    });
  });

  describe("ensureUnique", () => {
    it("should return original name if unique", () => {
      const usedNames = new Set(["existing1", "existing2"]);
      const result = NameSanitizer.ensureUnique("newname", usedNames);
      expect(result).toBe("newname");
    });

    it("should append number for duplicates", () => {
      const usedNames = new Set(["test", "test_1", "test_2"]);
      const result = NameSanitizer.ensureUnique("test", usedNames);
      expect(result).toBe("test_3");
    });

    it("should throw error after too many attempts", () => {
      const usedNames = new Set<string>();
      // Fill with many names to trigger the safety check
      for (let i = 0; i <= 1000; i++) {
        usedNames.add(`test_${i}`);
      }
      usedNames.add("test");

      expect(() => {
        NameSanitizer.ensureUnique("test", usedNames);
      }).toThrow("Failed to generate unique name");
    });
  });
});
