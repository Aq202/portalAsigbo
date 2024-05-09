/* eslint-disable no-console */
import mongoose from 'mongoose';
import config from 'config';

const uri = config.get('dbConnectionUri');
const connect = () => mongoose.connect(uri);

const { connection } = mongoose;
connection.on('error', () => console.error.bind(console, 'connection error'));

connection.once('open', () => {
  console.info('Conexión a la bd exitosa.');
});

mongoose.connection.on('connected', () => console.log('connected'));
mongoose.connection.on('open', () => console.log('open'));
mongoose.connection.on('disconnected', () => console.log('disconnected'));
mongoose.connection.on('reconnected', () => console.log('reconnected'));
mongoose.connection.on('disconnecting', () => console.log('disconnecting'));
mongoose.connection.on('close', () => console.log('close'));

export default connect;
export { connection };
