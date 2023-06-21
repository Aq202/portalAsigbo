import ActivitySchema from '../../db/schemas/activity.schema.js';
import ActivityAssignmentSchema from '../../db/schemas/activityAssignment.schema.js';
import AsigboAreaSchema from '../../db/schemas/asigboArea.schema.js';
import PaymentSchema from '../../db/schemas/payment.schema.js';
import UserSchema from '../../db/schemas/user.schema.js';
import CustomError from '../../utils/customError.js';
import { single as singleActivityDto } from './activity.dto.js';
import { single as singleAssignmentActivityDto } from './activityAssignment.dto.js';

const getUserActivities = async (idUser) => {
  const user = await UserSchema.findById(idUser);
  if (user === null) throw new CustomError('El usuario indicado no existe.', 404);

  const assignments = await ActivityAssignmentSchema.find({ 'user._id': idUser });
  if (assignments.length === 0) throw new CustomError('El usuario indicado no ha paraticipado en ninguna actividad', 404);

  const activities = [];

  await Promise.all(assignments.map(async (assignment) => {
    const activity = await ActivitySchema.findById(assignment.activity._id);
    activities.push(activity);
  }));

  return activities;
};

const createActivity = async ({
  name,
  date,
  serviceHours,
  responsible,
  idAsigboArea,
  idPayment,
  registrationStartDate,
  registrationEndDate,
  participatingPromotions,
  participantsNumber,
}) => {
  // obtener datos de area asigbo
  const asigboAreaData = await AsigboAreaSchema.findOne({ _id: idAsigboArea });

  if (asigboAreaData === null) throw new CustomError('No existe el área de asigbo.', 400);

  // obtener datos del pago (si existe)
  let paymentData = null;
  if (idPayment) {
    paymentData = await PaymentSchema.findOne({ _id: idPayment });

    if (paymentData === null) throw new CustomError('No existe el pago indicado.', 400);
  }

  // obtener datos de encargados
  const responsiblesData = await UserSchema.find({ _id: { $in: responsible } });

  if (responsiblesData === null || responsiblesData.length === 0) {
    throw new CustomError('No se encontraron usuarios válidos como encargados.', 400);
  }
  if (responsiblesData.length !== responsible.length) {
    throw new CustomError('Alguno de los encargados seleccionados no existen.', 400);
  }

  // guardar actividad
  const activity = new ActivitySchema();
  activity.name = name;
  activity.date = new Date(date);
  activity.serviceHours = serviceHours;
  activity.responsible = responsiblesData;
  activity.asigboArea = asigboAreaData;
  activity.payment = paymentData;
  activity.registrationStartDate = registrationStartDate;
  activity.registrationEndDate = registrationEndDate;
  activity.participatingPromotions = participatingPromotions?.length > 0 ? participatingPromotions : null;
  activity.availableSpaces = participantsNumber;

  const result = await activity.save();
  return singleActivityDto(result);
};

const assignUserToActivity = async ({
  idUser, idActivity, completed, activity, session,
}) => {
  try {
    // obtener datos de usuario
    const userData = await UserSchema.findOne({ _id: idUser });

    if (userData === null) throw new CustomError('El usuario proporcinado no existe.', 400);

    // obtener datos de la actividad
    let activityData = activity;
    if (!activity) {
      // Si la actividad no se pasa como parámetro, buscarla
      activityData = await ActivitySchema.findOne({ _id: idActivity, blocked: false });

      if (activityData === null) {
        throw new CustomError('La actividad proporcionada no existe.', 400);
      }
    }

    // verificar que hayan espacios disponibles
    if (!(activityData.availableSpaces > 0)) { throw new CustomError('La actividad no cuenta con espacios disponibles.', 403); }

    // disminuir el número de vacantes
    activityData.availableSpaces -= 1;
    await activityData.save({ session });

    const activityAssignment = new ActivityAssignmentSchema();

    activityAssignment.user = userData;
    activityAssignment.activity = activityData;
    activityAssignment.pendingPayment = activityData.payment !== null;
    activityAssignment.completed = completed ?? false;

    const result = await activityAssignment.save({ session });

    return singleAssignmentActivityDto(result);
  } catch (ex) {
    if (ex?.code === 11000) {
      // indice duplicado
      throw new CustomError('El usuario ya se encuentra inscrito en la actividad.', 400);
    }
    throw ex;
  }
};

const updateActivity = async ({
  session,
  id,
  name,
  date,
  serviceHours,
  responsible,
  idAsigboArea,
  idPayment,
  registrationStartDate,
  registrationEndDate,
  participatingPromotions,
  participantsNumber,
}) => {
  // obtener actividad
  const activity = await ActivitySchema.findOne({ _id: id, blocked: false });
  if (activity === null) throw new CustomError('No existe la actividad a actualizar.', 400);

  const dataBeforeChange = singleActivityDto(activity);

  // obtener datos de area asigbo
  const asigboAreaData = await AsigboAreaSchema.findOne({ _id: idAsigboArea });

  if (asigboAreaData === null) throw new CustomError('No existe el área de asigbo.', 400);

  // obtener datos de encargados
  const responsiblesData = await UserSchema.find({ _id: { $in: responsible } });

  if (responsiblesData === null || responsiblesData.length === 0) {
    throw new CustomError('No se encontraron usuarios válidos como encargados.', 400);
  }
  if (responsiblesData.length !== responsible.length) {
    throw new CustomError('Alguno de los encargados seleccionados no existen.', 400);
  }

  // realizar el cálculo de espacios disponibles
  if (participantsNumber !== undefined) {
    const registeredUsers = await ActivityAssignmentSchema.find({ 'activity._id': activity._id });

    if (registeredUsers.length > participantsNumber) {
      throw new CustomError(
        'El nuevo número de participantes en menor al número de becados que se encuentran ya inscritos.',
        400,
      );
    }

    activity.availableSpaces = participantsNumber - registeredUsers.length;
  }

  // actualizar actividad

  if (name !== undefined) activity.name = name;
  if (date !== undefined) activity.date = new Date(date);
  if (serviceHours !== undefined) activity.serviceHours = serviceHours;
  if (responsible !== undefined) activity.responsible = responsiblesData;
  if (idAsigboArea !== undefined) activity.asigboArea = asigboAreaData;
  if (idPayment !== undefined) activity.payment = idPayment;
  if (registrationStartDate !== undefined) activity.registrationStartDate = registrationStartDate;
  if (registrationEndDate !== undefined) activity.registrationEndDate = registrationEndDate;
  if (participatingPromotions !== undefined) {
    activity.participatingPromotions = participatingPromotions?.length > 0 ? participatingPromotions : null;
  }

  const result = await activity.save({ session });
  return {
    updatedData: singleActivityDto(result),
    dataBeforeChange,
  };
};

const updateActivityInAllAssignments = async ({ activity, session }) => ActivityAssignmentSchema.updateMany({ 'activity._id': activity.id }, { activity }, { session });

const getCompletedActivityAssignmentsById = async (id) => ActivityAssignmentSchema.find({ 'activity._id': id, completed: true });

const deleteActivity = async ({ activityId }) => {
  try {
  // verificar que no existan asignaciones a dicha actividad
    const assignments = await ActivityAssignmentSchema.find({ 'activity._id': activityId });

    if (assignments?.length > 0) throw new CustomError('No es posible eliminar, pues existen becados inscritos en la actividad.');

    const { deletedCount } = await ActivitySchema.deleteOne({ _id: activityId });

    if (deletedCount === 0) throw new CustomError('No se encontró la actividad a eliminar.', 404);
  } catch (ex) {
    if (ex?.kind === 'ObjectId') throw new CustomError('El id de la actividad no es válido.');
    throw ex;
  }
};

const unassignUserFromActivity = async ({ idUser, idActivity }) => {
  const assignmentData = await ActivityAssignmentSchema.findOne({ 'user._id': idUser, 'activity._id': idActivity });

  if (assignmentData === null) throw new CustomError('El usuario no se encuentra inscrito en la actividad.', 403);

  const { deletedCount } = await ActivityAssignmentSchema.deleteOne({ 'user._id': idUser, 'activity._id': idActivity });

  if (deletedCount !== 1) throw new CustomError('No se encontró la asignación a eliminar.', 404);

  return singleAssignmentActivityDto(assignmentData);
};

export {
  createActivity,
  assignUserToActivity,
  updateActivity,
  updateActivityInAllAssignments,
  getCompletedActivityAssignmentsById,
  deleteActivity,
  getUserActivities,
  unassignUserFromActivity,
};
