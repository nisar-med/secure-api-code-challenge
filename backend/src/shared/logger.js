// Minimal JSON logger: one line per event with a single ISO timestamp,
// matching the shape of the Gateway's logs so both can be read together.
function write(stream, level, fields) {
  stream(JSON.stringify({ level, timestamp: new Date().toISOString(), ...fields }));
}

export default {
  info: (fields) => write(console.log, 'info', fields),
  error: (fields) => write(console.error, 'error', fields),
};
