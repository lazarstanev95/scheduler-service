import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import path from "path";
import log4js from "log4js";
import apiRoutes from "./api";

log4js.configure(path.resolve('src', 'config', 'logger', 'log4js.json'));

dotenv.config();

export class Server {
    constructor() {
        this._app = express();
        this._httpServer = createServer(this._app);
        this._logger = log4js.getLogger('server');
    }

    async start() {
        this._app.use(log4js.connectLogger(log4js.getLogger('http'), {
            level: 'auto'
        }));
        this._app.use(cors());
        this._app.use(express.json());
        this.setRoutes();
        const serverPort = process.env.server_port || 5005;
        this._server = this._httpServer.listen(serverPort, () =>
            this._logger.info(`Server listening on port ${serverPort}`)
        );
    }

    stop() {
        this._logger.info("Stopping server.");
        this._server.close();
    }

    setRoutes() {
        this._app.get('/', (req, res) => {
            res.send('Service is UP!');
        });
        this._app.use('/api', apiRoutes);
    }
}