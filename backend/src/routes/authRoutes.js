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

const router = express.Router();

// Public routes - Supabase authentication
router.post('/signup', validate(schemas.signup), signup);
router.post('/register', validate(schemas.signup), signup); // Alias
router.post('/login', validate(schemas.login), login);
router.post('/refresh', refreshToken); // Token refresh endpoint - no auth required (uses refresh_token)
router.post('/forgot-password', validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), resetPassword);
router.post('/verify-email', verifyEmail);

// Protected routes - require Supabase JWT token
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);
router.patch('/profile', authenticate, validate(schemas.updateProfile), updateProfile);
router.delete('/account', authenticate, deleteAccount);

// Token verification endpoint - returns 200 if token is valid, 401 if not
router.get('/verify', authenticate, (req, res) => {
  // If we reach here, the authenticate middleware has already validated the token
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.id,
      email: req.user.email
    }
  });
});

// TTLock account connection (for Supabase users who want to link TTLock)
router.post('/connect-ttlock', authenticate, connectTTLockAccount);

export default router;
