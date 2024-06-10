import { single as activitySingle } from '../activity/activity.dto.js';
import { singlePaymentAssignmentDto } from '../payment/paymentAssignment.dto.js';
import { single as userSingle } from '../user/user.dto.js';

const single = (resource) => {
  const {
    user, activity, paymentAssignment, completed, aditionalServiceHours,
  } = resource._doc;
  return {
    id: resource._id?.valueOf(),
    user: userSingle(user),
    activity: activitySingle(activity),
    paymentAssignment: singlePaymentAssignmentDto(paymentAssignment),
    completed,
    aditionalServiceHours,
  };
};

const multiple = (resources) => resources.map((resource) => single(resource));

export { single, multiple };
