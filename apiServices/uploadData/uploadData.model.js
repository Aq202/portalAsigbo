import mongoose from 'mongoose';
import UserSchema from '../../db/schemas/user.schema.js';
import CustomError from '../../utils/customError.js';

const generateUsers = async ({ users }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!users || users.length === 0) throw new CustomError('Debe enviar por lo menos un registro.', 400);
    await UserSchema.insertMany(users, { session });
    await session.commitTransaction();
    session.endSession();
    return users;
  } catch (ex) {
    await session.abortTransaction();
    session.endSession();
    if (ex.errors) throw new CustomError(ex.errors[Object.keys(ex.errors)].message, 400);
    if (ex.code === 11000) {
      if (ex.message.includes('code')) throw new CustomError(`El id ${ex.writeErrors[0].err.op.code} ya existe en la base de datos`, 400);
      throw new CustomError(`El correo ${ex.writeErrors[0].err.op.email} ya existe en la base de datos`, 400);
    }
    throw ex;
  }
};

// eslint-disable-next-line import/prefer-default-export
export { generateUsers };
