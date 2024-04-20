import { AgendaWrapper } from "..";
import log4js from "log4js";
const logger = log4js.getLogger('alertsJob');

export async function runJob(job, done) {
    const agenda = AgendaWrapper.getAgenda();
    logger.info('agenda...', agenda);
    logger.info('Running job', job.attrs.name);
}