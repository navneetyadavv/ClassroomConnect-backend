import jwt from 'jsonwebtoken';

// Common authentication logic
const authenticate = (roleCheck) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // Validate token format
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check role if roleCheck function is provided
    if (roleCheck && !roleCheck(decoded.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      message: 'Invalid or expired token',
      ...(process.env.NODE_ENV === 'development' && { detail: err.message })
    });
  }
};

// Specific middlewares
export const ensureUserAuthenticated = authenticate((role) => 
  ['Teacher', 'Student'].includes(role)
);

export const ensurePrincipalAuthenticated = authenticate((role) => 
  role === 'Principal'
);

// Optional: Middleware for any authenticated user (no specific role required)
export const ensureAuthenticated = authenticate();