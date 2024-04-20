import log4js from "log4js";
const logger = log4js.getLogger('helpers');

export function handlerError(err, ns) {
    if (ns && typeof ns === "string") {
        logger.error(`Agenda Error in ${ns}:`);
    }
    if (err) {
        logger.error(`Agenda Error`);
        logger.error(JSON.stringify(err, null, 4));
    }
}