import async from "async";
import Agenda from "agenda";
import Agendash from "agendash";
import log4js from "log4js";
import * as alertsJob from "./jobs/alertsJob";
import { handlerError } from "./jobs/helpers";

const logger = log4js.getLogger('agendaWrapper');

export class AgendaWrapper {
    constructor() {
        this.agenda = null;
    }

    async start() {
        await AgendaWrapper.connectToAgenda();
    }

    static setAgenda(agenda) {
        this.agenda = agenda;
    }

    static getAgenda() {
        return this.agenda;
    }

    static async connectToAgenda() {
        const {
            mongo_app_username,
            mongo_app_password,
            mongo_ip,
            mongo_port,
            mongo_db_name
        } = process.env;

        logger.info("Attempting to connect to agenda");
        const dbName = mongo_db_name || 'agenda';
        let mongoConnectionString = `mongodb://${mongo_ip}:${mongo_port}/${dbName}`;
        if (mongo_app_username && mongo_app_password) {
            mongoConnectionString = `mongodb://${mongo_app_username}:${mongo_app_password}@${mongo_ip}:${mongo_port}/${dbName}`;
        }
        const agenda = new Agenda({
            db: { address: mongoConnectionString },
            processEvery: ' second',
            lockLimit: 0,
            defaultLockLifetime: 10000
        });
        agenda.on('ready', () => {
            agenda.start();
            agenda.jobs({}, (err, jobs) => {
                async.map(jobs, (job, cb) => {
                    const name = job.attrs.name;
                    logger.info(`defining job: ${job.attrs.name}`);
                    if (name.match(/^WatchList/)) {
                        //agenda.define(job.attrs.name, watchListJob.runJob);
                    } else {
                        agenda.define(job.attrs.name, alertsJob.runJob);
                    }
                }, handlerError);
            })
        });

        agenda.on('error', (err) => {
            return handlerError('error connecting to mongo database');
        });

        agenda.dashboard = () => {
            return Agendash(agenda);
        }

        const handlerErrorFromJob = (err, errLocation, job, callback) => {
            if (err) {
                handlerError(err, errLocation);
            }
            return callback(err, job);
        }

        agenda.runJob = (name, callback) => {
            agenda.jobs({ name: name }, (err, jobs) => {
                if (err) {
                    return handlerErrorFromJob(err, 'runNow', null, callback);
                }

                let job = jobs.pop();
                if (job) {
                    return job.run((err, job) => handlerErrorFromJob(err, 'runNow.job.run', job, callback));
                }
                return callback(`cannot find job "${name}"`);
            })
        }

        this.setAgenda(agenda);
        return agenda;
    }
}