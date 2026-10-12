import 'dotenv/config';

// Single place where process.env is read, so the rest of the app depends
// on a plain object rather than on the environment directly.
const env = {
  port: Number(process.env.PORT) || 4000,
};

export default env;
