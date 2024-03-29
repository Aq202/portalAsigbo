import { connection } from '../../db/connection.js';
import { updateServiceHours } from '../user/user.model.js';
import {
  assignUserToActivity,
} from './activityAssignment.model.js';

const assignUserToActivityMediator = async ({
  idUser,
  idActivity,
  completed,
  activity,
}) => {
  const session = await connection.startSession();
  try {
    session.startTransaction();

    const result = await assignUserToActivity({
      idUser,
      idActivity,
      completed,
      activity,
      session,
    });

    const {
      activity: {
        serviceHours,
        asigboArea: { id: asigboAreaId },
      },
      completed: completedValue,
    } = result;

    // si es una actividad completada, modificar total de horas de servicio
    if (completedValue === true && serviceHours > 0) {
      await updateServiceHours({
        userId: idUser,
        asigboAreaId,
        hoursToAdd: serviceHours,
        session,
      });
    }

    await session.commitTransaction();
    return result;
  } catch (ex) {
    await session.abortTransaction();

    throw ex;
  }
};

export default assignUserToActivityMediator;
