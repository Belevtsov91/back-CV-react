const { ZodError } = require("zod");
const { AppError } = require("../utils/AppError");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid JSON body",
        code: "INVALID_JSON"
      }
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: "APP_ERROR",
        details: err.details
      }
    });
  }

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error("Unexpected error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      message: isServerError ? "Internal server error" : err.message || "Request failed",
      code: isServerError ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    }
  });
}

module.exports = { errorHandler };
