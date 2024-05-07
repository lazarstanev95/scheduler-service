import express from "express";
import basicAuth from "express-basic-auth";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import path from "path";
import log4js from "log4js";
import { ConsulWrapper } from "./consul/consulWrapper";
import { MongoWrapper } from "./mongo/mongoWrapper";
import apiRoutes from "./api";
import { AgendaWrapper } from "./agenda";

log4js.configure(path.resolve('src', 'config', 'logger', 'log4js.json'));

dotenv.config();

export class Server {
    constructor() {
        this._app = express();
        this._httpServer = createServer(this._app);
        this._logger = log4js.getLogger('server');
        this._consul = new ConsulWrapper();
        this._mongoDB = new MongoWrapper();
        this._agenda = new AgendaWrapper();
    }

    async start() {
        this._app.use(log4js.connectLogger(log4js.getLogger('http'), {
            level: 'auto'
        }));
        await this._consul.start();
        await this._mongoDB.start();
        await this._agenda.start();
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
        const {
            dashboard_username,
            dashboard_password
        } = process.env;
        this._app.get('/', (req, res) => {
            res.send('Service is UP!');
        });
        this._app.use('/api', apiRoutes);
        this._app.use('/dashboard', basicAuth({
            users: { [dashboard_username]: dashboard_password },
            challenge: true
        }), AgendaWrapper.getAgendaDash());
    }
}