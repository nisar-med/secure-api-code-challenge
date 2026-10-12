import pino from 'pino';

// JSON-structured logs: one line per event, safe for ingestion by any
// log pipeline. No request bodies or tokens are ever logged.
// pino stamps every line itself; the key is renamed from its default
// "time" so each line carries exactly one ISO "timestamp" field.
export default pino({
  // Emit the level as a word ("info", "warn", "error") rather than pino's
  // numeric code, matching the Backend's logs.
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});
