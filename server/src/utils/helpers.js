/**
 * Wraps an async route handler to catch errors and forward to errorHandler.
 * Avoids try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Creates a standardized API response.
 */
const apiResponse = (res, statusCode, data, message = 'Success') => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Normalizes a date to midnight UTC for consistent date comparisons.
 */
const normalizeDate = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

module.exports = { asyncHandler, apiResponse, normalizeDate };
