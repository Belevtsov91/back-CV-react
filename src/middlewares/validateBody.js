function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(parsed.error);
    }

    req.body = parsed.data;
    return next();
  };
}

module.exports = { validateBody };
