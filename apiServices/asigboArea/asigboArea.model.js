import AsigboAreaSchema from '../../db/schemas/asigboArea.schema.js';
import UserSchema from '../../db/schemas/user.schema.js';
import ActivitySchema from '../../db/schemas/activity.schema.js';
import CustomError from '../../utils/customError.js';
import { multiple, single } from './asigboArea.dto.js';
import ActivityAssignmentSchema from '../../db/schemas/activityAssignment.schema.js';

/**
 * Permite validar si un usuario es un encargado de un eje de asigbo.
 * @param idUser Id del usuario a verificar.
 * @param idArea Id del eje en donde se va a verificar si el usuario es encargado.
 * @param preventError. Default false. Evita que se lance una excepción al no ser el encargado.
 * Por defecto, Lanza un CustomError si el usuario no posee dicho privilegio.
 * @return Boolean. Indica si el usuario es encargado del eje.
 */
const validateResponsible = async ({ idUser, idArea, preventError = false }) => {
  const { responsible } = await AsigboAreaSchema.findById(idArea);
  const isResponsible = responsible.some((user) => user._id.toString() === idUser);
  if (!isResponsible && !preventError) throw new CustomError('El usuario no es encargado de la actividad.', 403);
  return isResponsible;
};

/**
 * Permite actualizar la redundancia de datos en documentos dependientes.
 * @param area Documento de mongo correspondiente al area actualizada.
 * @param session sesión de la transacción.
 */
const updateAsigboAreaDependencies = async ({ area, session }) => {
  await ActivitySchema.updateMany(
    { 'asigboArea._id': area._id },
    { asigboArea: area },
    { session },
  );
  await ActivityAssignmentSchema.updateMany(
    { 'activity.asigboArea._id': area._id },
    { 'activity.asigboArea': area },
    { session },
  );

  // actualizar datos en las información de horas de servicio de cada usuario
  await UserSchema.updateMany(
    { 'serviceHours.areas.asigboArea._id': area._id },
    { $set: { 'serviceHours.areas.$.asigboArea': area } },
    { session, multi: true },
  );
};

const updateAsigboArea = async ({
  idArea, name, responsible, color, session,
}) => {
  try {
    const area = await AsigboAreaSchema.findById(idArea);
    if (area === null) throw new CustomError('El área de asigbo especificada no existe.', 404);

    const users = await UserSchema.find({ _id: { $in: responsible } });
    if (users?.length !== responsible.length) throw new CustomError('Algunos de los usuarios asignados como encargados no existen.', 404);

    const dataBeforeChange = single(area);

    area.name = name.trim();
    area.responsible = users;
    area.color = color;

    await area.save({ session });

    // actualizar actividades y asignaciones
    await updateAsigboAreaDependencies({ area, session });

    return { dataBeforeChange, dataAfterChange: single(area) };
  } catch (ex) {
    if (ex.code === 11000 && ex.keyValue?.name !== undefined) {
      throw new CustomError('El nombre proporcionado ya existe.', 400);
    }
    throw ex;
  }
};

const createAsigboArea = async ({
  name, responsible, color, session,
}) => {
  try {
    // añadir permisos de encargado a los usuarios
    const users = await UserSchema.find({ _id: { $in: responsible } });
    if (users?.length !== responsible.length) throw new CustomError('Algunos de los usuarios proporcionados como encargados no existen.', 404);

    const area = new AsigboAreaSchema();

    area.name = name.trim();
    area.responsible = users;
    area.color = color;

    await area.save({ session });
    return single(area);
  } catch (ex) {
    if (ex.code === 11000 && ex.keyValue?.name !== undefined) {
      throw new CustomError('El nombre proporcionado ya existe.', 400);
    }
    throw ex;
  }
};

/**
 * Permite eliminar un área de asigbo. Fallará cuando esta cuente alguna actividad existente.
 * @param idArea id del area
 * @param session objeto session de la transacción de bd
 * @returns Area. Si se completa exitosamente, devuelve la data del eje eliminado.
 */
const deleteAsigboArea = async ({ idArea, session }) => {
  try {
    const { deletedCount, acknowledged } = await AsigboAreaSchema.deleteOne({ _id: idArea }, { session });

    if (!acknowledged) throw new CustomError('No se completó la eliminación del eje.', 500);
    if (deletedCount !== 1) throw new CustomError('No se encontró el eje a eliminar.', 404);
  } catch (ex) {
    if (ex?.kind === 'ObjectId') {
      throw new CustomError('No se encontró la información del eje proporcionado.', 404);
    }
    throw ex;
  }
};

const updateAsigboAreaBlockedStatus = async ({ idArea, blocked, session }) => {
  try {
    const area = await AsigboAreaSchema.findById({ _id: idArea });

    if (area === null) throw new CustomError('No se encontró el eje a modificar.', 404);

    area.blocked = blocked;

    await area.save({ session });

    await updateAsigboAreaDependencies({ area, session });
  } catch (ex) {
    if (ex?.kind === 'ObjectId') {
      throw new CustomError('No se encontró la información del eje proporcionado.', 404);
    }
    throw ex;
  }
};

/**
 * Devuelve el listado de áreas de asigbo.
 * @returns Area dto array.
 */
const getAreas = async () => {
  const asigboAreas = await AsigboAreaSchema.find();
  if (asigboAreas.length === 0) throw new CustomError('No se han encontrado ejes de asigbo.', 404);
  return multiple(asigboAreas);
};

/**
 * Devuelve los datos de un eje de asigbo.
 * @param {string} idArea Id del área a buscar.
 * @returns Area dto
 */
const getArea = async ({ idArea }) => {
  try {
    const result = await AsigboAreaSchema.findById(idArea);
    if (result === null) {
      throw new CustomError('No se encontró la información del área proporcionada.', 404);
    }
    return single(result);
  } catch (ex) {
    if (ex?.kind === 'ObjectId') {
      throw new CustomError('No se encontró la información del área proporcionada.', 404);
    }
    throw ex;
  }
};

/**
 * Devuelve el listado de áreas en donde el usuario es responsable.
 * @param {string} idUser: Id del usuario a consultar.
 * @param {session} object: Objeto sesión.
 * @returns Area dto array.
 */
const getAreasWhereUserIsResponsible = async ({ idUser, session }) => {
  const results = await AsigboAreaSchema.find({ responsible: { $elemMatch: { _id: idUser } } }).session(session);

  if (results.length === 0) throw new CustomError('No se encontraron resultados.', 404);

  return multiple(results);
};

export {
  createAsigboArea,
  updateAsigboArea,
  getAreas,
  deleteAsigboArea,
  getArea,
  updateAsigboAreaBlockedStatus,
  validateResponsible,
  getAreasWhereUserIsResponsible,
};
