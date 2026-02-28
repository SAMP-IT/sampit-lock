import express from 'express';
import {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getCurrentUser,
  updateProfile,
  refreshToken,
  deleteAccount
} from '../controllers/authController.js';
import { connectTTLockAccount } from '../controllers/ttlockAuthController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Public routes - Supabase authentication
router.post('/signup', validate(schemas.signup), asyncHandler(signup));
router.post('/register', validate(schemas.signup), asyncHandler(signup)); // Alias
router.post('/login', validate(schemas.login), asyncHandler(login));
router.post('/refresh', validate(schemas.refreshToken), asyncHandler(refreshToken));
router.post('/forgot-password', validate(schemas.forgotPassword), asyncHandler(forgotPassword));
router.post('/reset-password', validate(schemas.resetPassword), asyncHandler(resetPassword));
router.post('/verify-email', validate(schemas.verifyEmail), asyncHandler(verifyEmail));

// Protected routes - require Supabase JWT token
router.post('/logout', authenticate, asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(getCurrentUser));
router.patch('/profile', authenticate, validate(schemas.updateProfile), asyncHandler(updateProfile));
router.delete('/account', authenticate, asyncHandler(deleteAccount));

// Token verification endpoint - returns 200 if token is valid, 401 if not
router.get('/verify', authenticate, asyncHandler((req, res) => {
  // If we reach here, the authenticate middleware has already validated the token
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.id,
      email: req.user.email
    }
  });
}));

// TTLock account connection (for Supabase users who want to link TTLock)
router.post('/connect-ttlock', authenticate, asyncHandler(connectTTLockAccount));

export default router;
