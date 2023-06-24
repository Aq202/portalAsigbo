import express from 'express';
import ensureAdminAuth from '../../middlewares/ensureAdminAuth.js';
import ensureRefreshTokenAuth from '../../middlewares/ensureRefreshTokenAuth.js';

import {
  createActivityController,
  deleteActivityController,
  getActivitiesController,
  getActivityController,
  updateActivityController,
  getLoggedActivitiesController,
  getUserActivitiesController,
} from './activity.controller.js';
import validateBody from '../../middlewares/validateBody.js';
import createActivitySchema from './validationSchemas/createActivitySchema.js';
import updateActivitySchema from './validationSchemas/updateActivitySchema.js';

const activityRouter = express.Router();

activityRouter.get('/', ensureAdminAuth, getActivitiesController);
activityRouter.get(
  '/logged',
  ensureRefreshTokenAuth,
  getLoggedActivitiesController,
);

activityRouter.get(
  '/:idUser',
  ensureAdminAuth,
  getUserActivitiesController,
);

activityRouter.get('/:idActivity', ensureAdminAuth, getActivityController);
activityRouter.post(
  '/',
  ensureAdminAuth,
  validateBody(createActivitySchema),
  createActivityController,
);
activityRouter.patch(
  '/',
  ensureAdminAuth,
  validateBody(updateActivitySchema),
  updateActivityController,
);

activityRouter.delete('/:idActivity', ensureAdminAuth, deleteActivityController);
export default activityRouter;
