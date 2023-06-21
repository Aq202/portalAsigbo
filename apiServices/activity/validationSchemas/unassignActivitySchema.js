import yup from 'yup';
import validateId from '../../../utils/validateId.js';

export default yup.object().shape({
  idActivity: yup
    .string()
    .nullable()
    .required("El campo 'idActivity' es obligatorio.")
    .test('validate-id', "El campo 'idActivity' no es un id válido.", (id) => validateId(id)),
  idUser: yup
    .string()
    .nullable()
    .required("El campo 'idUser' es obligatorio.")
    .test('validate-id', "El campo 'idUser' no es un id válido.", (id) => validateId(id)),
});
