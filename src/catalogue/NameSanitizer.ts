export class NameSanitizer {
  private static readonly VALID_NAME_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

  static toSnake(input: string): string {
    return input
      .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase to snake_case
      .replace(/[^A-Za-z0-9_]/g, '_') // Replace invalid chars with underscore
      .toLowerCase()
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  }

  static stripForbidden(input: string): string {
    // Remove all characters that are not alphanumeric or underscore
    let cleaned = input.replace(/[^A-Za-z0-9_]/g, '_');
    
    // Collapse multiple underscores into one
    cleaned = cleaned.replace(/_+/g, '_');
    
    // Remove leading and trailing underscores
    cleaned = cleaned.replace(/^_+|_+$/g, '');
    
    // Ensure the result is not empty
    if (cleaned === '') {
      cleaned = 'action';
    }
    
    // Ensure it doesn't exceed 64 characters
    if (cleaned.length > 64) {
      cleaned = cleaned.substring(0, 64);
    }
    
    return cleaned;
  }

  static sanitizeActionName(actionName: string): string {
    // First convert to snake_case if it's camelCase
    let sanitized = this.toSnake(actionName);
    
    // Then strip any remaining forbidden characters
    sanitized = this.stripForbidden(sanitized);
    
    // Validate the result
    if (!this.VALID_NAME_PATTERN.test(sanitized)) {
      throw new Error(`Failed to sanitize action name: ${actionName} -> ${sanitized}`);
    }
    
    return sanitized;
  }

  static ensureUnique(baseName: string, usedNames: Set<string>): string {
    let candidateName = baseName;
    let counter = 1;
    
    while (usedNames.has(candidateName)) {
      candidateName = `${baseName}_${counter++}`;
      
      // Safety check to prevent infinite loops
      if (counter > 1000) {
        throw new Error(`Failed to generate unique name for: ${baseName}`);
      }
    }
    
    return candidateName;
  }
}
