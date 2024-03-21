import mongoose, { connect } from "mongoose";
import log4js from "log4js";

const logger = log4js.getLogger('mongoWrapper');
const CONNECTION_EVENT_PREFIX = 'Mongo connection';

export class MongoWrapper {
    constructor() {
    }

    async start () {
        await MongoWrapper.connectToDb();
    }

    static async connectToDb() {
        const {
            mongo_admin_username,
            mongo_admin_password,
            mongo_app_username,
            mongo_app_password,
            mongo_ip,
            mongo_port,
            mongo_db_name,
        } = process.env;
        logger.info("Atempting to connect to mongo db - ", mongo_ip);
        const mongoUrl = `mongodb://${mongo_ip}:${mongo_port}`;
        let connection = null;
        try {
            connection = await connect(mongoUrl, {
                user: mongo_admin_username,
                pass: mongo_admin_password,
                dbName: 'admin'
            });
            logger.info("Connected to mongo db with admin.");
            const mongoDB = mongoose.connection.db;
            await MongoWrapper.deleteDbUser(mongoDB, mongo_app_username, mongo_db_name);
            await MongoWrapper.createDbUser(mongoDB, mongo_app_username, mongo_app_password, mongo_db_name);
        } catch (err) {
            logger.error(err);
        } finally {
            if (connection) {
                await connection.disconnect();
                logger.info("Disconnected from mongo database with admin.");
                await connect(mongoUrl, {
                    user: mongo_app_username,
                    pass: mongo_app_password,
                    dbName: mongo_db_name
                });
                logger.info(`Connected to mongo db with user: ${mongo_app_username}.`);
                mongoose.connection.on('error', err => logger.error(`${CONNECTION_EVENT_PREFIX} error: ${err}`));
                mongoose.connection.on('disconnecting', () => logger.error(`${CONNECTION_EVENT_PREFIX} disconnecting...`));
                mongoose.connection.on('disconnected', () => logger.error(`${CONNECTION_EVENT_PREFIX} disconnected`));
                mongoose.connection.on('close', () => logger.error(`${CONNECTION_EVENT_PREFIX} closed`));
                mongoose.connection.on('reconnected', () => logger.error(`${CONNECTION_EVENT_PREFIX} reconnected`));
            }
        }
    }

    static async createDbUser(db, userName, password, databaseName) {
        try {
            await db.addUser(userName, password, {
                roles: [
                    {
                        role: 'readWrite',
                        db: databaseName
                    }
                ]
            });
            logger.info(`User ${userName} created with readWrite access to ${databaseName}.`);
        } catch (err) {
            logger.info(`User ${userName} already exist for mongo database: ${databaseName}.`);
        }
    }

    static async deleteDbUser(db, userName, databaseName) {
        try {
            await db.removeUser(userName);
            logger.info(`User ${userName} was deleted from database: ${databaseName}.`);
        } catch (err) {
            logger.info(`User ${userName} was not deleted from database: ${databaseName}.`);
        }
    }
}