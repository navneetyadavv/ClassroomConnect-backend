import Joi from 'joi';

// Common validation schemas
const commonSchemas = {
  email: Joi.string().email().required(),
  password: Joi.string().min(4).max(100).required(),
  name: Joi.string().min(3).max(100).required(),
  role: Joi.string().valid('Teacher', 'Student').required()
};

// Reusable validation function
const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: "Validation error",
      details: error.details.map(d => d.message) // More client-friendly
    });
  }
  next();
};

// Specific validators
export const userCreationValidation = validateRequest(
  Joi.object({
    name: commonSchemas.name,
    email: commonSchemas.email,
    password: commonSchemas.password,
    role: commonSchemas.role
  })
);

export const userLoginValidation = validateRequest(
  Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password
  })
);