import { multiple as multipleUser } from '../user/user.dto.js';

const single = (resource) => {
  const {
    name, responsible, blocked,
  } = resource._doc;
  return {
    id: resource._id.valueOf(),
    name,
    responsible: multipleUser(responsible),
    blocked,
  };
};

const multiple = (resources) => resources.map((resource) => single(resource));

export { single, multiple };
