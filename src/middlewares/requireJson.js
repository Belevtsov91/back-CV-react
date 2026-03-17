function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(415).json({
      success: false,
      error: {
        message: "Content-Type must be application/json",
        code: "UNSUPPORTED_MEDIA_TYPE"
      }
    });
  }

  return next();
}

module.exports = { requireJson };
