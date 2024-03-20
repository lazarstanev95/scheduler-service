import { Server } from "./src/server";
import log4js from "log4js";

const logger = log4js.getLogger('entry-point');

(async function() {
    try {
        const server = new Server();
        await server.start();    
    } catch (err) {
        logger.fatal('Server error has occured', err);
    }
})()