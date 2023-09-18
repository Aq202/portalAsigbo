import { connection } from '../../db/connection.js';
import CustomError from '../../utils/customError.js';
import exists from '../../utils/exists.js';
import parseBoolean from '../../utils/parseBoolean.js';
import { addActivityAvailableSpaces, getActivity } from '../activity/activity.model.js';
import { getUser, getUsersInList, updateServiceHours } from '../user/user.model.js';
import {
  assignManyUsersToActivity,
  assignUserToActivity,
  getActivityAssignments,
  unassignUserFromActivity,
  updateActivityAssignment,
} from './activityAssignment.model.js';

const getActivitiesAssigmentsController = async (req, res) => {
  const { idUser } = req.query;
  try {
    const activities = await getActivityAssignments({ idUser });
    res.send(activities);
  } catch (ex) {
    let err = 'Ocurrio un error al obtener las asignaciones a actividades.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const getActivitiesAssigmentsByActivityController = async (req, res) => {
  const { idActivity } = req.params;
  try {
    const activities = await getActivityAssignments({ idActivity });
    res.send(activities);
  } catch (ex) {
    let err = 'Ocurrio un error al obtener las asignaciones de la actividad.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const getActivityAssigmentController = async (req, res) => {
  const { idActivity, idUser } = req.params;
  try {
    const activities = await getActivityAssignments({ idActivity, idUser });
    res.send(activities[0]);
  } catch (ex) {
    let err = 'Ocurrio un error al obtener la asignación de la actividad.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const getLoggedActivitiesController = async (req, res) => {
  try {
    const activities = await getActivityAssignments({ idUser: req.session.id });
    res.send(activities);
  } catch (ex) {
    let err = 'Ocurrio un error al obtener las actividades del usuario.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const assignUserToActivityController = async (req, res) => {
  const { idUser, idActivity } = req.params;
  const { completed } = req.body;

  const session = await connection.startSession();
  try {
    session.startTransaction();

    const activity = await getActivity({ idActivity, showSensitiveData: true });
    const user = await getUser({ idUser, showSensitiveData: true });

    // validar que la promoción esté incluida
    if (
      activity.participatingPromotions !== null
      && !activity.participatingPromotions.includes(user.promotion)
    ) {
      throw new CustomError('La actividad no está disponible para la promoción del usuario.');
    }

    // verificar que hayan espacios disponibles
    if (!(activity.availableSpaces > 0)) {
      throw new CustomError('La actividad no cuenta con suficientes espacios disponibles.', 403);
    }

    await assignUserToActivity({
      user,
      completed,
      activity,
      session,
    });

    // restar 1 en espacios disponibles de actividad
    await addActivityAvailableSpaces({ idActivity, value: -1, session });

    const {
      serviceHours,
      asigboArea: { id: asigboAreaId },
    } = activity;

    // si es una actividad completada, modificar total de horas de servicio
    if (parseBoolean(completed) === true && serviceHours > 0) {
      await updateServiceHours({
        userId: idUser,
        asigboAreaId,
        hoursToAdd: serviceHours,
        session,
      });
    }

    await session.commitTransaction();

    res.sendStatus(204);
  } catch (ex) {
    await session.abortTransaction();

    let err = 'Ocurrio un error al asignar usuarios a una actividad.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const assignManyUsersToActivityController = async (req, res) => {
  const { idUsersList, idActivity, completed } = req.body;
  const session = await connection.startSession();
  try {
    session.startTransaction();

    const activity = await getActivity({ idActivity, showSensitiveData: true });

    const users = await getUsersInList({ idUsersList, showSensitiveData: true });

    // Asignar a todos los usuarios.
    const assignmentsList = [];
    idUsersList.forEach((idUser) => {
      const user = users.find((u) => u.id === idUser);

      // validar que la promoción esté incluida
      if (
        activity.participatingPromotions !== null
        && !activity.participatingPromotions.includes(user.promotion)
      ) {
        throw new CustomError(`La actividad no está disponible para la promoción del usuario ${user.name} ${user.lastname}.`);
      }

      // verificar que hayan espacios disponibles
      if (!(activity.availableSpaces >= users.length)) {
        throw new CustomError('La actividad no cuenta con suficientes espacios disponibles.', 403);
      }

      assignmentsList.push({ user, activity, completed });
    });

    await assignManyUsersToActivity({ assignmentsList, session });

    // restar espacios disponibles de actividad
    await addActivityAvailableSpaces({ idActivity, value: users.length, session });

    await session.commitTransaction();

    res.sendStatus(204);
  } catch (ex) {
    let err = 'Ocurrio un error al asignar lista de usuarios a una actividad.';
    let status = 500;

    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const unassignUserFromActivityController = async (req, res) => {
  const { idActivity, idUser } = req.params;

  const session = await connection.startSession();

  try {
    session.startTransaction();

    const result = await unassignUserFromActivity({ idActivity, idUser, session });
    const {
      activity: {
        serviceHours,
        asigboArea: { _id: asigboAreaId },
      },
      completed,
    } = result;

    // habilitar espacios en al actividad
    await addActivityAvailableSpaces({ idActivity, value: 1, session });

    // si es una actividad completada, modificar total de horas de servicio
    if (completed === true && serviceHours > 0) {
      await updateServiceHours({
        userId: idUser,
        asigboAreaId,
        hoursToRemove: serviceHours,
        session,
      });
    }

    await session.commitTransaction();

    res.sendStatus(204);
  } catch (ex) {
    await session.abortTransaction();

    let err = 'Ocurrio un error al desasignar al usuario de la actividad.';
    let status = 500;
    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

const updateActivityAssignmentController = async (req, res) => {
  const { idActivity, idUser } = req.params;
  const { completed, aditionalServiceHours } = req.body;
  const session = await connection.startSession();

  try {
    session.startTransaction();

    const result = await updateActivityAssignment({
      idUser,
      idActivity,
      completed,
      aditionalServiceHours,
      session,
    });

    // Valores de asignación previos a la modificación
    const {
      activity: {
        serviceHours,
        asigboArea: { _id: asigboAreaId },
      },
      completed: prevCompletedResultValue,
      aditionalServiceHours: prevAditionalServiceHours,
    } = result;

    const parsedAditionalServiceHours = exists(aditionalServiceHours) ? parseInt(aditionalServiceHours, 10) : null;

    if (exists(aditionalServiceHours) && !exists(completed) && prevCompletedResultValue) {
      // Realizar unicamente ajuste de horas adicionales para actividad completada
      const hoursToAdd = parsedAditionalServiceHours - (prevAditionalServiceHours ?? 0);
      if (hoursToAdd !== 0) { // Valores negativos restan al total
        await updateServiceHours({
          userId: idUser,
          asigboAreaId,
          hoursToAdd,
          session,
        });
      }
    } else if (exists(completed) && prevCompletedResultValue !== parseBoolean(completed)) {
      // Se modificó el valor completed
      if (parseBoolean(completed)) {
        // agregar horas + horas adicionales (si también se modificaron, utilizar valor nuevo)
        const hoursToAdd = serviceHours + (parsedAditionalServiceHours ?? prevAditionalServiceHours ?? 0);
        if (hoursToAdd > 0) {
          await updateServiceHours({
            userId: idUser,
            asigboAreaId,
            hoursToAdd,
            session,
          });
        }
      } else {
        // remover horas + horas adicionales previas (sin importar que se haya actualizado)
        const hoursToRemove = serviceHours + (prevAditionalServiceHours ?? 0);
        if (hoursToRemove > 0) {
          await updateServiceHours({
            userId: idUser,
            asigboAreaId,
            hoursToRemove,
            session,
          });
        }
      }
    }

    await session.commitTransaction();

    res.sendStatus(204);
  } catch (ex) {
    await session.abortTransaction();

    let err = 'Ocurrio un error al cambiar estado de completado en la asignación de la actividad.';
    let status = 500;
    if (ex instanceof CustomError) {
      err = ex.message;
      status = ex.status ?? 500;
    }
    res.statusMessage = err;
    res.status(status).send({ err, status });
  }
};

export {
  assignUserToActivityController,
  assignManyUsersToActivityController,
  getActivitiesAssigmentsByActivityController,
  getLoggedActivitiesController,
  unassignUserFromActivityController,
  updateActivityAssignmentController,
  getActivitiesAssigmentsController,
  getActivityAssigmentController,
};
