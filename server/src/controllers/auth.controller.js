const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, apiResponse } = require('../utils/helpers');

/**
 * Generate JWT tokens (access + refresh)
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

  return { accessToken, refreshToken };
};

/**
 * POST /api/auth/login
 * Login with username + password
 */
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required',
    });
  }

  // Find user and explicitly select passwordHash (excluded by default)
  const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = generateTokens(user._id);

  apiResponse(res, 200, {
    user: user.toJSON(),
    ...tokens,
  }, 'Login successful');
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }

  const tokens = generateTokens(user._id);

  apiResponse(res, 200, tokens, 'Token refreshed');
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
exports.getMe = asyncHandler(async (req, res) => {
  apiResponse(res, 200, { user: req.user });
});
