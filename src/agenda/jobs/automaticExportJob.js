import moment from "moment";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import log4js from "log4js";
import { AgendaWrapper } from "..";
import { getPriority } from "../helpers";
import { exec } from 'child_process';
const logger = log4js.getLogger('automaticExportJob');

const JOB_NAME_RECURRING = "Automatic Export Job Recurring";
const JOB_NAME_INITIAL = "Automatic Export Job Initial";

let dateNow = moment().format('YYYY-MM-DDTH-mm-ss');
let backupDir = path.join('backup', dateNow);

export function createJob(data, interval, callback) {
    const agenda = AgendaWrapper.getAgenda();
    agenda.define(JOB_NAME_INITIAL, {
        priority: getPriority(data.priority)
    }, runJob);
    logger.info(`Actual interval parameter = ${interval}`);

    const exportHourOfDayUtc = data.schedule.exportHourOfDayUtc;

    const nextRunDateUtc = moment().utc();
    nextRunDateUtc.set('hour', exportHourOfDayUtc);
    nextRunDateUtc.set('minute', 0);
    nextRunDateUtc.set('second', 0);
    nextRunDateUtc.set('millisecond', 0);

    const isInitialRunToday = moment().utc().hour() < exportHourOfDayUtc;

    if (!isInitialRunToday) {
        nextRunDateUtc.add(1, 'days');
    }
    logger.info(`Next run (in UTC): ${nextRunDateUtc.toISOString()}`);

    const isDevMode = data.schedule.units === 'minutes';
    let nextRun = `${isInitialRunToday ? "today" : "tomorrow"} at ${exportHourOfDayUtc}`;
    if (isDevMode) {
        nextRun = `${new Date().getUTCHours()}:${new Date().getUTCMinutes() + 1}`;
    }

    agenda.schedule(
        nextRun,
        JOB_NAME_INITIAL,
        {
            ...data,
            name: JOB_NAME_INITIAL,
            identifier: JOB_NAME_INITIAL
        },
        () => callback && callback(null, JOB_NAME_INITIAL)
    );
}

export function deleteJob(data, done) {
    const agenda = AgendaWrapper.getAgenda();
    logger.info(`Deleting automatic export job (initial/recurring)`);
    agenda.cancel({ name: JOB_NAME_INITIAL }, () => {
        agenda.cancel({ name: JOB_NAME_RECURRING }, done)
    });
}

export async function runJob(job, done) {
    const {
        mongo_admin_username,
        mongo_admin_password
    } = process.env;
    const agenda = AgendaWrapper.getAgenda();
    const isDevMode = job.attrs.data.schedule.units === 'minutes';
    logger.info(`Starting ${job.attrs.name} in ${isDevMode ? "dev mode." : "production mode."}`);
    const isFirstRun = job.attrs.name === JOB_NAME_INITIAL && !job.attrs.lastFinishedAt;

    const config = {
        dbName: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        username: mongo_admin_username,
        password: mongo_admin_password,
        authenticationDbName: 'admin'
    }

    try {
        purgeOldFiles(isDevMode);
        await backupDB({ config });
        if (!isFirstRun) {
            done(null, job.attrs.data);
        }
    } catch (error) {
        logger.error(`failed with error ${JSON.stringify(error)}`);
        return done(error);
    }

    if (isFirstRun) {
        agenda.cancel({ name: JOB_NAME_INITIAL }, () => {
            const data = job.attrs.data;
            agenda.define(JOB_NAME_RECURRING, {
                priority: getPriority(data.priority)
            }, runJob);

            logger.info(`Creating ${JOB_NAME_RECURRING}`);

            agenda.every(data.schedule.repeat, JOB_NAME_RECURRING, {
                schedule: {
                    amount: data.schedule.amount,
                    units: data.schedule.units,
                    repeat: data.schedule.repeat
                },
                identifier: JOB_NAME_RECURRING,
                name: JOB_NAME_RECURRING,
                priority: data.priority,
                initialExportRunAt: moment.utc().toDate()
            }, () => {
                done(null, job.attrs.data);
            });
        });
    }
}

function backupDB({ config }) {
    const {
        dbName,
        host,
        port,
        username,
        password,
        authenticationDbName
    } = config;
    logger.info(`Backing up MongoDB database ${dbName} ...`);
    logger.info(`host ${host}`);
    logger.info(`port ${port}`);
    const dbBackupDir = path.join(backupDir, 'db');
    logger.info(`dir ${dbBackupDir}`)
    return new Promise(async (resolve, reject) => {
        try {
            // TODO dump data with mongoose
            //exec(`mongodump --forceTableScan --username ${username} --password ${password} --authenticationDatabase ${authenticationDbName} --db "${dbName}" --host "${host}" --port "${port}" -o "${dbBackupDir}"`);
            logger.info(`[SUCCESS] Backing up MongoDB to ${dbBackupDir}`);
            resolve();
        } catch (err) {
            logger.error(`[ERROR] Backing up MongoDB: ${err}`);
            reject(err);
        }
    });
}

function purgeOldFiles(isDevMode) {
    try {
        const filenames = fs.readdirSync(path.join('backup'));
        filenames.forEach((filename) => {
            const filePath = path.join('backup', filename);
            const fileStats = fs.statSync(filePath);

            const date60DaysAgo = moment().subtract(60, 'd');
            const isOlderThan60Days = moment(fileStats.birthtime).isBefore(date60DaysAgo, 'minutes');

            const date5MinAgo = moment().subtract(5, 'm');
            const isOlderThan5Mins = moment(fileStats.birthtime).isBefore(date5MinAgo, 'minutes');

            let shouldDelete = isOlderThan60Days;
            if (isDevMode) {
                shouldDelete = isOlderThan5Mins;
            }

            if (shouldDelete) {
                try {
                    fs.unlinkSync(filePath);
                    logger.info("Removed file", filePath);
                } catch (err) {
                    logger.error(`Failed to remove file ${filePath}, error: ${JSON.stringify(err)}`);
                }
            }
        })
    } catch (err) {
        logger.error(`Purge of old files failed with error: ${JSON.stringify(err)}`);
        return;
    }
}