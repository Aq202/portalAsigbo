import express from 'express';
import ensureRefreshTokenAuth from '../../middlewares/ensureRefreshTokenAuth.js';

import {
  createActivityController,
  deleteActivityController,
  getActivitiesController,
  getActivityController,
  updateActivityController,
  getLoggedActivitiesController,
  enableActivityController,
  disableActivityController,
  getActivitiesWhereUserIsResponsibleController,
  uploadActivitiesDataController,
} from './activity.controller.js';
import validateBody from '../../middlewares/validateBody.js';
import createActivitySchema from './validationSchemas/createActivitySchema.js';
import updateActivitySchema from './validationSchemas/updateActivitySchema.js';
import ensureRolesAuth from '../../middlewares/ensureRolesAuth.js';
import multerMiddleware from '../../middlewares/multerMiddleware.js';
import uploadImage from '../../services/uploadFiles/uploadImage.js';
import ensureAreaResponsibleAuth from '../../middlewares/ensureAreaResponsibleAuth.js';
import ensureActivityResponsibleAuth from '../../middlewares/ensureActivityResponsibleAuth.js';
import consts from '../../utils/consts.js';

const activityRouter = express.Router();

activityRouter.get(
  '/',
  ensureActivityResponsibleAuth,
  getActivitiesController,
);
activityRouter.get('/logged', ensureRefreshTokenAuth, getLoggedActivitiesController);

activityRouter.get('/:idActivity', ensureRefreshTokenAuth, getActivityController);

activityRouter.post(
  '/',
  ensureAreaResponsibleAuth,
  multerMiddleware(uploadImage.single('banner')),
  validateBody(createActivitySchema),
  createActivityController,
);
activityRouter.patch(
  '/:idActivity',
  ensureAreaResponsibleAuth,
  multerMiddleware(uploadImage.single('banner')),
  validateBody(updateActivitySchema),
  updateActivityController,
);

activityRouter.delete(
  '/:idActivity',
  ensureAreaResponsibleAuth,
  deleteActivityController,
);

activityRouter.patch(
  '/:idActivity/enable',
  ensureAreaResponsibleAuth,
  enableActivityController,
);
activityRouter.patch(
  '/:idActivity/disable',
  ensureAreaResponsibleAuth,
  disableActivityController,
);

activityRouter.get(
  '/responsible/:idUser',
  ensureRolesAuth(null),
  getActivitiesWhereUserIsResponsibleController,
);

activityRouter.post(
  '/uploadData',
  ensureRolesAuth(
    [
      consts.roles.admin,
      consts.roles.asigboAreaResponsible,
      consts.roles.activityResponsible,
    ],
    'El usuario no cuenta con privilegios de administrador, encargado de eje de asigbo, encargado de actividad o encargado de promoción.',
  ),
  uploadActivitiesDataController,
);

export default activityRouter;
