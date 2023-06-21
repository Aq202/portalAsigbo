const validateBody = (...schemas) => async (req, res, next) => {
  try {
    await Promise.all(schemas?.map((schema) => schema.validate(req.body)));
    return next();
  } catch (err) {
    res.statusMessage = err.message;
    return res.status(400).send({ err: err.message, status: 400, ok: false });
  }
};

export default validateBody;
