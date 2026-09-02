const Joi = require('joi');

const clientContextSchema = Joi.object({
  browser_name: Joi.string().max(80).allow(null, '').optional(),
  browser_version: Joi.string().max(80).allow(null, '').optional(),
  os_name: Joi.string().max(80).allow(null, '').optional(),
  os_version: Joi.string().max(80).allow(null, '').optional(),
  device_type: Joi.string().max(50).allow(null, '').optional(),
  is_mobile: Joi.boolean().optional(),
  timezone: Joi.string().max(80).allow(null, '').optional(),
  language: Joi.string().max(40).allow(null, '').optional(),
  platform: Joi.string().max(120).allow(null, '').optional(),
  device_vendor: Joi.string().max(120).allow(null, '').optional(),
  device_model: Joi.string().max(120).allow(null, '').optional(),
  screen_width: Joi.number().integer().min(0).allow(null).optional(),
  screen_height: Joi.number().integer().min(0).allow(null).optional(),
  referrer: Joi.string().max(2048).allow(null, '').optional(),
  country_code: Joi.string().max(8).allow(null, '').optional(),
  region: Joi.string().max(120).allow(null, '').optional(),
  city: Joi.string().max(120).allow(null, '').optional()
}).optional();

const loginSchema = Joi.object({
  email: Joi.string().min(4).required(),
  password: Joi.string().required(),
  trusted_device_token: Joi.string().max(2048).allow('', null).optional(),
  client_context: clientContextSchema
});

const profileUpdateSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional(),
  avatar_url: Joi.string().uri().allow('').optional(),
  location: Joi.string().max(255).allow('').optional(),
  institution_id: Joi.string().uuid().allow(null, '').optional(),
  institution: Joi.string().max(255).allow('').optional(),
  affiliate_university: Joi.string().max(255).allow('').optional(),
  programme_category: Joi.string().max(255).allow('').optional(),
  program: Joi.string().max(255).allow('').optional(),
  program_id: Joi.string().uuid().allow(null, '').optional(),
  level: Joi.string().max(50).allow('').optional(),
  semester: Joi.string().valid('1', '2').allow('').optional(),
  index_number: Joi.string().max(80).allow('').optional(),
  country_code: Joi.string().length(2).allow('').optional(),
  phone_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow('').optional()
});

const validateData = (schema, data) => {
  return schema.validate(data, { abortEarly: false });
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = validateData(schema, req.body);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

module.exports = {
  validateLoginData: (data) => validateData(loginSchema, data),
  validateProfileUpdateData: (data) => validateData(profileUpdateSchema, data),
  validate
};
