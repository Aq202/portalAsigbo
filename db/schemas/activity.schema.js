import { Schema, model } from 'mongoose';
import { asigboAreaSubSchema } from './asigboArea.schema.js';
import { paymentSubSchema } from './payment.schema.js';
import { userSubSchema } from './user.schema.js';

const activitySchema = Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  serviceHours: { type: Number, required: true },
  responsible: {
    type: [userSubSchema],
    required: true,
    validate: {
      validator(responsibles) {
        return responsibles.length > 0;
      },
      message: 'Debe proporcionar al menos un encargado de la actividad.',
    },
  },
  asigboArea: { type: asigboAreaSubSchema, required: true },
  payment: { type: paymentSubSchema },
  registrationStartDate: { type: Date, required: true },
  registrationEndDate: { type: Date, required: true },
  participatingPromotions: { type: [Number], default: null },
});

const ActivitySchema = model('activity', activitySchema);
export default ActivitySchema;
