// Wrap async route handlers so thrown errors reach this middleware
// instead of crashing the process or hanging the request.
function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "23505") {
    // Postgres unique_violation
    return res.status(409).json({ error: "That value already exists." });
  }
  if (err.code === "23503") {
    // foreign_key_violation
    return res.status(400).json({ error: "Referenced record does not exist." });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}

module.exports = { asyncRoute, errorHandler };
