/**
 * Validation utility functions for form inputs
 * Provides email validation, password strength checking, and input sanitization
 */

/**
 * Validates email format using RFC 5322 compliant regex
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if email is valid
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified but comprehensive)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Additional checks
  if (email.length > 254) return false; // Max email length
  if (email.split('@').length !== 2) return false; // Must have exactly one @
  
  const [localPart, domain] = email.split('@');
  if (localPart.length > 64) return false; // Local part max length
  if (domain.length > 253) return false; // Domain max length
  if (!domain.includes('.')) return false; // Domain must have at least one dot
  
  return emailRegex.test(email.trim());
};

/**
 * Checks password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * @param {string} password - Password to check
 * @returns {object} - { isValid: boolean, strength: string, requirements: object }
 */
export const checkPasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      strength: 'weak',
      requirements: {
        minLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        hasSpecialChar: false,
      },
      message: 'Password is required'
    };
  }

  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metRequirements = Object.values(requirements).filter(Boolean).length;
  const totalRequirements = Object.keys(requirements).length;

  let strength = 'weak';
  if (metRequirements === totalRequirements) {
    strength = 'strong';
  } else if (metRequirements >= 3) {
    strength = 'medium';
  }

  const isValid = metRequirements === totalRequirements;

  let message = '';
  if (!isValid) {
    const missing = [];
    if (!requirements.minLength) missing.push('8 characters');
    if (!requirements.hasUpperCase) missing.push('uppercase letter');
    if (!requirements.hasLowerCase) missing.push('lowercase letter');
    if (!requirements.hasNumber) missing.push('number');
    if (!requirements.hasSpecialChar) missing.push('special character');
    message = `Missing: ${missing.join(', ')}`;
  }

  return {
    isValid,
    strength,
    requirements,
    message
  };
};

/**
 * Sanitizes input to prevent SQL injection and XSS attacks
 * Removes or escapes dangerous characters
 * @param {string} input - Input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input, options = {}) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const {
    allowSpaces = true,
    allowSpecialChars = false,
    maxLength = 255,
    trim = true
  } = options;

  let sanitized = input;

  // Trim whitespace if requested
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Remove SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /('|(\\')|(;)|(\\)|(\/\*)|(\*\/)|(--)|(\[)|(\])|(\{)|(\})|(\()|(\)))/g,
  ];

  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove XSS patterns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Remove event handlers like onclick=
  ];

  xssPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // If special chars not allowed, remove them (except spaces if allowed)
  if (!allowSpecialChars) {
    if (allowSpaces) {
      sanitized = sanitized.replace(/[^a-zA-Z0-9\s]/g, '');
    } else {
      sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
    }
  }

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Validates name input (first name, last name)
 * @param {string} name - Name to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      message: 'Name is required'
    };
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      message: 'Name cannot be empty'
    };
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      message: 'Name must be at least 2 characters'
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      message: 'Name must be less than 50 characters'
    };
  }

  // Check for SQL injection patterns
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)|('|(\\')|(;)|(\\)|(\/\*)|(\*\/)|(--))/gi;
  if (sqlPatterns.test(trimmed)) {
    return {
      isValid: false,
      message: 'Name contains invalid characters'
    };
  }

  // Allow letters, spaces, hyphens, and apostrophes
  const namePattern = /^[a-zA-Z\s'-]+$/;
  if (!namePattern.test(trimmed)) {
    return {
      isValid: false,
      message: 'Name can only contain letters, spaces, hyphens, and apostrophes'
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validates email input with sanitization
 * @param {string} email - Email to validate
 * @returns {object} - { isValid: boolean, message: string, sanitized: string }
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      message: 'Email is required',
      sanitized: ''
    };
  }

  // Sanitize email (allow @ and . for email format)
  let sanitized = email.trim().toLowerCase();
  
  // Remove dangerous characters but keep email-valid characters
  sanitized = sanitized.replace(/[<>\"'%;()&+]/g, '');
  
  // Check for SQL injection patterns
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)|(;)|(\\)|(\/\*)|(\*\/)|(--)/gi;
  if (sqlPatterns.test(sanitized)) {
    return {
      isValid: false,
      message: 'Email contains invalid characters',
      sanitized: ''
    };
  }

  if (!isValidEmail(sanitized)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address',
      sanitized: sanitized
    };
  }

  return {
    isValid: true,
    message: '',
    sanitized: sanitized
  };
};

/**
 * Validates password with strength check
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, message: string, strength: object }
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password is required',
      strength: null
    };
  }

  // Check for SQL injection patterns in password
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)|(;)|(\\)|(\/\*)|(\*\/)|(--)/gi;
  if (sqlPatterns.test(password)) {
    return {
      isValid: false,
      message: 'Password contains invalid characters',
      strength: null
    };
  }

  const strengthCheck = checkPasswordStrength(password);
  
  return {
    isValid: strengthCheck.isValid,
    message: strengthCheck.message || 'Password is strong',
    strength: strengthCheck
  };
};

/**
 * Validates phone number input
 * @param {string} phone - Phone number to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: true, message: '' }; // Phone is optional
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { isValid: true, message: '' }; // Empty is fine (optional)
  }

  // Strip formatting characters to count actual digits
  const digitsOnly = trimmed.replace(/[\s\-\(\)\+\.]/g, '');

  // Must only contain digits after stripping formatting
  if (!/^\d+$/.test(digitsOnly)) {
    return {
      isValid: false,
      message: 'Phone number can only contain digits, spaces, hyphens, and parentheses'
    };
  }

  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      message: 'Phone number must be at least 10 digits'
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      message: 'Phone number must be 15 digits or fewer'
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Validates that passwords match
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (!confirmPassword || typeof confirmPassword !== 'string') {
    return {
      isValid: false,
      message: 'Please confirm your password'
    };
  }

  if (password !== confirmPassword) {
    return {
      isValid: false,
      message: 'Passwords do not match'
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

