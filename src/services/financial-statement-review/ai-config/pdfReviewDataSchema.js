/**
 * PDF Review Data Schema - Version 1.0.0
 * 
 * Strict schema definition for pdfReviewData contract between PDF flow and Main flow.
 * This schema is versioned and must be updated with version bump for breaking changes.
 */

const SCHEMA_VERSION = "1.0.0";

/**
 * Validates pdfReviewData against schema version 1.0.0
 * @param {Object} data - The pdfReviewData object to validate
 * @returns {Object} - Validation result with { valid: boolean, errors: string[] }
 */
function validatePdfReviewData(data) {
  const errors = [];

  // Check if data is an object
  if (!data || typeof data !== 'object') {
    errors.push("pdfReviewData must be an object");
    return { valid: false, errors };
  }

  // Validate schemaVersion
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${SCHEMA_VERSION}", got "${data.schemaVersion}"`);
  }

  // Validate pageMappings (optional but if present must be object)
  if (data.pageMappings !== undefined) {
    if (typeof data.pageMappings !== 'object' || Array.isArray(data.pageMappings)) {
      errors.push("pageMappings must be an object mapping page numbers to section names");
    }
  }

  // Validate visualFindings (array)
  if (!Array.isArray(data.visualFindings)) {
    errors.push("visualFindings must be an array");
  } else {
    data.visualFindings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object') {
        errors.push(`visualFindings[${index}] must be an object`);
      } else {
        if (finding.page !== undefined && typeof finding.page !== 'number') {
          errors.push(`visualFindings[${index}].page must be a number`);
        }
        if (!finding.description || typeof finding.description !== 'string') {
          errors.push(`visualFindings[${index}].description must be a non-empty string`);
        }
      }
    });
  }

  // Validate structureFindings (array)
  if (!Array.isArray(data.structureFindings)) {
    errors.push("structureFindings must be an array");
  } else {
    data.structureFindings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object') {
        errors.push(`structureFindings[${index}] must be an object`);
      } else {
        if (finding.page !== undefined && typeof finding.page !== 'number') {
          errors.push(`structureFindings[${index}].page must be a number`);
        }
        if (!finding.description || typeof finding.description !== 'string') {
          errors.push(`structureFindings[${index}].description must be a non-empty string`);
        }
      }
    });
  }

  // Validate terminologyFindings (array)
  if (!Array.isArray(data.terminologyFindings)) {
    errors.push("terminologyFindings must be an array");
  } else {
    data.terminologyFindings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object') {
        errors.push(`terminologyFindings[${index}] must be an object`);
      } else {
        if (finding.page !== undefined && typeof finding.page !== 'number') {
          errors.push(`terminologyFindings[${index}].page must be a number`);
        }
        if (!finding.description || typeof finding.description !== 'string') {
          errors.push(`terminologyFindings[${index}].description must be a non-empty string`);
        }
      }
    });
  }

  // Validate dateFindings (array)
  if (!Array.isArray(data.dateFindings)) {
    errors.push("dateFindings must be an array");
  } else {
    data.dateFindings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object') {
        errors.push(`dateFindings[${index}] must be an object`);
      } else {
        if (finding.page !== undefined && typeof finding.page !== 'number') {
          errors.push(`dateFindings[${index}].page must be a number`);
        }
        if (!finding.description || typeof finding.description !== 'string') {
          errors.push(`dateFindings[${index}].description must be a non-empty string`);
        }
      }
    });
  }

  // Validate formattingFindings (array)
  if (!Array.isArray(data.formattingFindings)) {
    errors.push("formattingFindings must be an array");
  } else {
    data.formattingFindings.forEach((finding, index) => {
      if (!finding || typeof finding !== 'object') {
        errors.push(`formattingFindings[${index}] must be an object`);
      } else {
        if (finding.page !== undefined && typeof finding.page !== 'number') {
          errors.push(`formattingFindings[${index}].page must be a number`);
        }
        if (!finding.description || typeof finding.description !== 'string') {
          errors.push(`formattingFindings[${index}].description must be a non-empty string`);
        }
      }
    });
  }

  // Validate summary (required string)
  if (typeof data.summary !== 'string') {
    errors.push("summary must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Schema definition for reference
 */
const pdfReviewDataSchema = {
  schemaVersion: SCHEMA_VERSION,
  description: "PDF Review Data Schema - Contract between PDF flow and Main flow",
  required: ["schemaVersion", "visualFindings", "structureFindings", "terminologyFindings", "dateFindings", "formattingFindings", "summary"],
  properties: {
    schemaVersion: {
      type: "string",
      enum: [SCHEMA_VERSION],
      description: "Schema version identifier"
    },
    pageMappings: {
      type: "object",
      description: "Mapping of page numbers to section names (optional)",
      additionalProperties: {
        type: "string"
      }
    },
    visualFindings: {
      type: "array",
      description: "Array of visual layout issues (T1)",
      items: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number where issue was found" },
          description: { type: "string", description: "Concise description of the visual issue" }
        },
        required: ["description"]
      }
    },
    structureFindings: {
      type: "array",
      description: "Array of document structure issues (T2)",
      items: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number where issue was found" },
          description: { type: "string", description: "Concise description of the structure issue" }
        },
        required: ["description"]
      }
    },
    terminologyFindings: {
      type: "array",
      description: "Array of terminology issues",
      items: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number where issue was found" },
          description: { type: "string", description: "Concise description of the terminology issue" }
        },
        required: ["description"]
      }
    },
    dateFindings: {
      type: "array",
      description: "Array of date consistency issues (T13)",
      items: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number where issue was found" },
          description: { type: "string", description: "Concise description of the date issue" }
        },
        required: ["description"]
      }
    },
    formattingFindings: {
      type: "array",
      description: "Array of formatting issues (T24, T25)",
      items: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number where issue was found" },
          description: { type: "string", description: "Concise description of the formatting issue" }
        },
        required: ["description"]
      }
    },
    summary: {
      type: "string",
      description: "Concise summary of all PDF findings (target < 500 characters)"
    }
  }
};

module.exports = {
  SCHEMA_VERSION,
  pdfReviewDataSchema,
  validatePdfReviewData
};

