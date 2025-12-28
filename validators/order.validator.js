const Joi = require("joi");

const createOrderSchema = Joi.object({
  amazonOrderNo: Joi.string().required(),
  buyerPaypal: Joi.string().email().required(),
  orderName: Joi.string().min(3).required(),
  comments: Joi.string().allow("", null),
  buyerName: Joi.string().min(3).required(),
});

module.exports = {
  createOrderSchema,
};
