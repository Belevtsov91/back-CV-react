const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CV React Backend API",
    version: "1.0.0",
    description: "Express API for contact form processing with validation and error handling."
  },
  servers: [
    {
      url: "https://back-cv-react.onrender.com",
      description: "Production"
    },
    {
      url: "http://localhost:4000",
      description: "Local development"
    }
  ],
  tags: [
    { name: "System", description: "Service status endpoints" },
    { name: "Messages", description: "Contact form endpoints" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        description: "Returns server status and runtime metadata.",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/api/messages": {
      post: {
        tags: ["Messages"],
        summary: "Create contact message",
        description: "Accepts and validates contact form data.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageCreateRequest" },
              example: {
                name: "John Doe",
                email: "john@example.com",
                subject: "Job opportunity",
                message: "I would like to discuss a frontend role with you."
              }
            }
          }
        },
        responses: {
          201: {
            description: "Message accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageCreateSuccess" }
              }
            }
          },
          400: {
            description: "Invalid JSON body or validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationErrorResponse" }
              }
            }
          },
          415: {
            description: "Unsupported media type",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          429: {
            description: "Rate limit exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          503: {
            description: "Message could not be delivered (DB save and all notifications failed)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded"], example: "ok" },
              db: { type: "string", enum: ["connected", "disconnected"], example: "connected" },
              uptime: { type: "number", example: 42.1 },
              timestamp: { type: "string", format: "date-time" },
              environment: { type: "string", example: "development" }
            },
            required: ["status", "db", "uptime", "timestamp", "environment"]
          }
        },
        required: ["success", "data"]
      },
      MessageCreateRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          email: { type: "string", format: "email", maxLength: 254 },
          subject: { type: "string", minLength: 1, maxLength: 100 },
          message: { type: "string", minLength: 10, maxLength: 2000 }
        },
        required: ["name", "email", "subject", "message"]
      },
      MessageCreateSuccess: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              receivedAt: { type: "string", format: "date-time" }
            },
            required: ["receivedAt"]
          }
        },
        required: ["success", "data"]
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              message: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_ERROR" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string", example: "email" },
                    message: { type: "string", example: "Invalid email address" }
                  },
                  required: ["field", "message"]
                }
              }
            },
            required: ["message", "code"]
          }
        },
        required: ["success", "error"]
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" }
            },
            required: ["message", "code"]
          }
        },
        required: ["success", "error"]
      }
    }
  }
};

module.exports = { openApiSpec };
