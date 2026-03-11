/**
 * Utilidad de Logging Estructurado para SaaS Multi-tenant
 * Compatible con Google Cloud Logging.
 */
module.exports = {
    log: (severity, message, context = {}) => {
        const logEntry = {
            severity,
            message,
            ...context,
            timestamp: new Date().toISOString(),
            service: 'bellapro-functions'
        };
        console.log(JSON.stringify(logEntry));
    },
    info: (message, context) => module.exports.log('INFO', message, context),
    warn: (message, context) => module.exports.log('WARNING', message, context),
    error: (message, context) => module.exports.log('ERROR', message, context)
};
