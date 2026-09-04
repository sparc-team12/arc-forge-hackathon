import { FastifyRequest, FastifyReply } from "fastify";
import { ValidationError } from "./errorHandler.js";

export interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

export interface ValidationRule {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validate a value against a validation rule
 */
function validateValue(
  value: any,
  rule: ValidationRule,
  fieldName: string
): string | null {
  // Check if required field is missing
  if (
    rule.required &&
    (value === undefined || value === null || value === "")
  ) {
    return `${fieldName} is required`;
  }

  // If field is not required and is missing, skip validation
  if (!rule.required && (value === undefined || value === null)) {
    return null;
  }

  // Type validation
  switch (rule.type) {
    case "string":
      if (typeof value !== "string") {
        return `${fieldName} must be a string`;
      }
      if (rule.minLength && value.length < rule.minLength) {
        return `${fieldName} must be at least ${rule.minLength} characters long`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `${fieldName} must be no more than ${rule.maxLength} characters long`;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return `${fieldName} format is invalid`;
      }
      break;

    case "number":
      const num = Number(value);
      if (isNaN(num)) {
        return `${fieldName} must be a number`;
      }
      if (rule.min !== undefined && num < rule.min) {
        return `${fieldName} must be at least ${rule.min}`;
      }
      if (rule.max !== undefined && num > rule.max) {
        return `${fieldName} must be no more than ${rule.max}`;
      }
      break;

    case "boolean":
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        return `${fieldName} must be a boolean`;
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return `${fieldName} must be an array`;
      }
      if (rule.minLength && value.length < rule.minLength) {
        return `${fieldName} must contain at least ${rule.minLength} items`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `${fieldName} must contain no more than ${rule.maxLength} items`;
      }
      break;

    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        return `${fieldName} must be an object`;
      }
      break;
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    return `${fieldName} must be one of: ${rule.enum.join(", ")}`;
  }

  // Custom validation
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (customResult !== true) {
      return typeof customResult === "string"
        ? customResult
        : `${fieldName} is invalid`;
    }
  }

  return null;
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: any,
  schema: Record<string, ValidationRule>
): string[] {
  const errors: string[] = [];

  for (const [fieldName, rule] of Object.entries(schema)) {
    const value = obj?.[fieldName];
    const error = validateValue(value, rule, fieldName);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Create a validation middleware for a specific schema
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return async function validationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const bodyErrors = validateObject(request.body, schema.body);
      errors.push(...bodyErrors);
    }

    // Validate query parameters
    if (schema.query) {
      const queryErrors = validateObject(request.query, schema.query);
      errors.push(...queryErrors);
    }

    // Validate path parameters
    if (schema.params) {
      const paramErrors = validateObject(request.params, schema.params);
      errors.push(...paramErrors);
    }

    // If there are validation errors, throw a ValidationError
    if (errors.length > 0) {
      throw new ValidationError("Validation failed", {
        errors,
        fields: {
          body: request.body,
          query: request.query,
          params: request.params,
        },
      });
    }
  };
}

/**
 * Common validation schemas for reuse
 */
export const commonValidations = {
  // ID parameter validation
  idParam: {
    params: {
      id: {
        type: "string" as const,
        required: true,
        pattern: /^\d+$/,
      },
    },
  },

  // Pagination query validation
  pagination: {
    query: {
      limit: {
        type: "string" as const,
        required: false,
        custom: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 && num <= 100;
        },
      },
      offset: {
        type: "string" as const,
        required: false,
        custom: (value: string) => {
          const num = parseInt(value);
          return !isNaN(num) && num >= 0;
        },
      },
    },
  },

  // Issue status validation
  issueStatus: {
    type: "string" as const,
    enum: ["not_started", "in_progress", "done"],
  },

  // Email validation
  email: {
    type: "string" as const,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },

  // Hex color validation
  hexColor: {
    type: "string" as const,
    pattern: /^#[0-9a-fA-F]{6}$/,
  },

  // Non-empty string validation
  nonEmptyString: {
    type: "string" as const,
    required: true,
    minLength: 1,
  },

  // User ID validation (for BetterAuth string IDs)
  userId: {
    type: "string" as const,
    required: true,
    minLength: 1,
  },
};

/**
 * Validation schemas for specific API endpoints
 */
export const validationSchemas = {
  // Issues
  createIssue: {
    body: {
      title: commonValidations.nonEmptyString,
      description: {
        type: "string" as const,
        required: false,
        maxLength: 2000,
      },
      status: {
        ...commonValidations.issueStatus,
        required: false,
      },
      assigned_user_id: {
        ...commonValidations.userId,
        required: false,
      },
      tag_ids: {
        type: "array" as const,
        required: false,
        maxLength: 10,
      },
    },
  },

  updateIssue: {
    ...commonValidations.idParam,
    body: {
      title: {
        type: "string" as const,
        required: false,
        minLength: 1,
        maxLength: 500,
      },
      description: {
        type: "string" as const,
        required: false,
        maxLength: 2000,
      },
      status: {
        ...commonValidations.issueStatus,
        required: false,
      },
      assigned_user_id: {
        type: "string" as const,
        required: false,
      },
      tag_ids: {
        type: "array" as const,
        required: false,
        maxLength: 10,
      },
    },
  },

  issueFilters: {
    ...commonValidations.pagination,
    query: {
      ...commonValidations.pagination.query,
      status: {
        ...commonValidations.issueStatus,
        required: false,
      },
      assigned_user_id: {
        type: "string" as const,
        required: false,
      },
      tag_id: {
        type: "string" as const,
        required: false,
        pattern: /^\d+$/,
      },
      search: {
        type: "string" as const,
        required: false,
        maxLength: 200,
      },
    },
  },

  // Tags
  createTag: {
    body: {
      name: {
        ...commonValidations.nonEmptyString,
        maxLength: 50,
      },
      color: {
        ...commonValidations.hexColor,
        required: false,
      },
    },
  },

  // Generic ID parameter
  idParam: commonValidations.idParam,
};
