const Joi = require("joi");

const createOrderSchema = Joi.object({
  amazonOrderNo: Joi.string().required(),
  buyerPaypal: Joi.string().required(),
  orderName: Joi.string().min(3).required(),
  comments: Joi.string().allow("", null),
  buyerName: Joi.string().min(3).required(),
  sheetName: Joi.string().allow("", null),
});

module.exports = {
  createOrderSchema,
};
