import Consul from "consul";
import log4js from "log4js";
import { CONFIG_PATH_PREFIX, consulKeys } from "./consul.config";

const logger = log4js.getLogger('consulWrapper');
const devModeExceptionKeys = [
    "mongo-ip",
    "mongo-port",
    "mongo-db-name",
    "mongo-app-username",
    "mongo-app-password",
    "mongo-admin-username",
    "mongo-admin-password",
    "dashboard-username",
    "dashboard-password"
];

const getConsulKeys = () => {
    if (process.env.NODE_ENV === "production") {
        return consulKeys;
    }
    logger.warn('DEV MODE: Skipping the processing of the following configuration keys -', devModeExceptionKeys);
    return consulKeys.filter(key => devModeExceptionKeys.indexOf(key) === -1);
}

export class ConsulWrapper {
    _consul;

    constructor() {
        this._consul = this.connect();
    }

    connect() {
        const { consul_ip, consul_port } = process.env;
        logger.info(`Connection to consul at ${consul_ip}:${consul_port}`);
        const consul = new Consul({
            host: consul_ip,
            port: consul_port,
            secure: false
        });
        return consul;
    }

    async start() {
        await this.setValuesInMemory();
        this.setWatchers();
    }

    async getKV(key) {
        const value = await this._consul.kv.get(key);
        return value;
    }

    async setValuesInMemory() {
        await getConsulKeys().reduce(async (acc, current, index) => {
            logger.info(`Processing configuration key '${current}'`);
            const kvp = await this.getKV(`${CONFIG_PATH_PREFIX}${current}`);
            const key = consulKeyToEnvVar(current);
            const accP = await acc;
            process.env[key] = kvp.Value;
            const res = {
                [key]: kvp.Value
            }
            accP.push(res);
            return [...accP];
        }, Promise.resolve([]));
    }

    setWatchers() {
        const watchers = this.createWatchers();
        watchers.forEach(watcher => {
            const watch = this._consul.watch(watcher);
            watch.on("change", async (data, res) => {
                if (data) {
                    const key = data.Key.replace(CONFIG_PATH_PREFIX, '');
                    const envKey = consulKeyToEnvVar(key);
                    const newValue = data.Value.trim();
                    if (process.env[envKey] && process.env[envKey]?.trim() !== newValue) {
                        logger.info(`Restarting due to consul ${envKey} value change.`);
                        process.exit(1);
                    }
                }
            });
            watch.on("error", (err) => {
                logger.error("Error", err);
            });
        });
    }

    createWatchers() {
        const watchers = getConsulKeys().reduce((acc, current) => {
            const watcher = {
                method: this._consul.kv.get,
                options: { key: `${CONFIG_PATH_PREFIX}${current}` },
                backoffFactor: 1000
            }
            acc.push(watcher);
            return acc;
        }, []);
        return watchers;
    }

    getKey = (path) => this._consul.kv.get({ key: path });
    setKey = (path, value) => this._consul.kv.set({ key: path, value });
}

export const consulKeyToEnvVar = (value) => {
    return value.replace(/-/g, "_");
}