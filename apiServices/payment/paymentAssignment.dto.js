import { single as singleUserDto } from '../user/user.dto.js';
import { singlePaymentDto } from './payment.dto.js';

const singlePaymentAssignmentDto = (resource) => {
  const {
    _id, id, user, payment, vouchersKey, completed, confirmed, completedDate, confirmedDate, treasurer,
  } = resource._doc ?? resource;
  return {
    id: resource._id?.valueOf() ?? _id?.valueOf() ?? id,
    _id: resource._id?.valueOf() ?? _id?.valueOf() ?? id,
    user: user ? singleUserDto(user) : undefined,
    payment: payment ? singlePaymentDto(payment) : undefined,
    vouchersKey,
    completed,
    confirmed,
    completedDate,
    confirmedDate,
    treasurer: treasurer ? singleUserDto(treasurer) : undefined,
  };
};

const multiplePaymentAssignmentDto = (resources) => resources.map((resource) => singlePaymentAssignmentDto(resource));

export { singlePaymentAssignmentDto, multiplePaymentAssignmentDto };