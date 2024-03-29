import { ObjectId } from 'mongodb';
import ActivityAssignmentSchema from '../../db/schemas/activityAssignment.schema.js';
import consts from '../../utils/consts.js';
import CustomError from '../../utils/customError.js';
import exists, { someExists } from '../../utils/exists.js';
import Promotion from '../promotion/promotion.model.js';
import { multiple, single as singleAssignmentActivityDto } from './activityAssignment.dto.js';

/**
 * Permite obtener las asignaciones de una actividad.
 * @param idUser Filtro para obtener asignaciones de un usuario. (Opcional)
 * @param idActivity Filtro para obtener asignaciones de una actividad. (Opcional)
 * @param search Cadena a buscar en el nombre de la actividad asignada. (Opcional)
 * @param lowerDate Límite inferior en la fecha de la actividad asignada. (Opcional)
 * @param upperDate Límite superior en la fecha de la actividad asignada. (Opcional)
 * @param page Pagina a consultar. Inicia en cero. Si es null devuelve el listado completo.
 * @param includeUserPromotionGroup Boolean. Indica si se debe agregar el grupo de promoción del usuario.
 * @returns
 */
const getActivityAssignments = async ({
  idUser, idActivity, search = null, lowerDate = null, upperDate = null, page = null, includeUserPromotionGroup = true,
}) => {
  try {
    const query = {};

    if (exists(idUser)) query['user._id'] = idUser;
    if (exists(idActivity)) query['activity._id'] = idActivity;
    if (someExists(lowerDate, upperDate)) query['activity.date'] = {};
    if (exists(lowerDate)) query['activity.date'].$gte = lowerDate;
    if (exists(upperDate)) query['activity.date'].$lte = upperDate;
    if (exists(search)) {
      // buscar cadena en nombre de la actividad
      const searchRegex = new RegExp(search, 'i');
      query['activity.name'] = { $regex: searchRegex };
    }

    const options = {};
    if (exists(page)) {
      options.skip = page * consts.resultsNumberPerPage;
      options.limit = consts.resultsNumberPerPage;
    }

    const assignments = await ActivityAssignmentSchema.find(query, null, options).sort({
      'activity._id': 1,
      completed: -1,
      pendingPayment: 1,
    });
    if (assignments.length === 0) {
      throw new CustomError('No se encontraron resultados.', 404);
    }

    const parsedAssignments = multiple(assignments);

    if (!includeUserPromotionGroup) return parsedAssignments;
    const promotion = new Promotion();

    return await Promise.all(
      parsedAssignments.map(async (assignment) => {
        // Agregar grupo de promoción al usuario
        const copy = assignment;
        copy.user.promotionGroup = await promotion.getPromotionGroup(assignment.user.promotion);
        return copy;
      }),
    );
  } catch (ex) {
    if (ex?.kind === 'ObjectId') {
      throw new CustomError('Los ids proporcionados no son válidos.', 400);
    }
    throw ex;
  }
};

const assignUserToActivity = async ({
  user, completed, activity, session, aditionalServiceHours = 0,
}) => {
  try {
    const activityAssignment = new ActivityAssignmentSchema();

    activityAssignment.user = user;
    activityAssignment.activity = activity;
    activityAssignment.pendingPayment = activity.payment !== null;
    activityAssignment.completed = completed ?? false;
    activityAssignment.aditionalServiceHours = aditionalServiceHours;

    await activityAssignment.save({ session });
  } catch (ex) {
    if (ex?.code === 11000) {
      // indice duplicado
      throw new CustomError('El usuario ya se encuentra inscrito en la actividad.', 400);
    }
    throw ex;
  }
};

/**
 * Permite asignar a varios usuarios a una actividad de forma simultánea.
 * @param assignmentsList Array of objects. Los objetos del arreglo deben tener la forma
 * {user: objeto del usuario, activity: objeto de la actividad, pendingPayment: boolean, completed: boolean}
 */
const assignManyUsersToActivity = async ({ assignmentsList, session }) => {
  try {
    await ActivityAssignmentSchema.insertMany(assignmentsList, { session });
  } catch (ex) {
    if (ex?.code === 11000) {
      // indice duplicado
      throw new CustomError(
        'Alguno de los usuarios ya se encuentra inscrito en la actividad.',
        400,
      );
    }
    throw ex;
  }
};

const getCompletedActivityAssignmentsById = async (id) => ActivityAssignmentSchema.find({ 'activity._id': id, completed: true });

const unassignUserFromActivity = async ({ idActivity, idUser, session }) => {
  const assignmentData = await ActivityAssignmentSchema.findOneAndDelete(
    { 'user._id': idUser, 'activity._id': idActivity },
    { session },
  );

  if (!assignmentData) { throw new CustomError('El usuario no se encuentra inscrito en la actividad.', 403); }

  return singleAssignmentActivityDto(assignmentData);
};

/**
 * Permite modificar el estado de completado de la asignación a la actividad.
 * @param {idUser, idActivity, completed, session}
 * @returns ActivityAssignment object. Datos de la asignación previo a la modificación.
 */
const updateActivityAssignment = async ({
  idUser, idActivity, completed, aditionalServiceHours, session,
}) => {
  const dataToUpdate = {};

  if (exists(completed)) dataToUpdate.completed = completed;
  if (exists(aditionalServiceHours)) dataToUpdate.aditionalServiceHours = aditionalServiceHours;

  const assignmentData = await ActivityAssignmentSchema.findOneAndUpdate(
    { 'user._id': idUser, 'activity._id': idActivity },
    dataToUpdate,
    { session },
  );

  if (assignmentData === null) {
    throw new CustomError('El usuario no se encuentra inscrito en la actividad.', 404);
  }

  return singleAssignmentActivityDto(assignmentData);
};

const getActivityAssignment = async ({
  idUser, idActivity, session,
}) => {
  try {
    const assignments = await ActivityAssignmentSchema.find({ 'user._id': new ObjectId(idUser), 'activity._id': new ObjectId(idActivity) });

    return assignments;
  } catch (ex) {
    await session.abortTransaction();
    if (ex?.kind === 'ObjectId') {
      throw new CustomError('Los ids proporcionados no son válidos.', 400);
    }
    throw ex;
  }
};

export {
  assignUserToActivity,
  getCompletedActivityAssignmentsById,
  getActivityAssignments,
  unassignUserFromActivity,
  updateActivityAssignment,
  assignManyUsersToActivity,
  getActivityAssignment,
};
