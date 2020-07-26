import { LoggerService, LogLevel } from '../services/logger.service';
/**
 * @publicApi
 */
export declare class NestApplicationContextOptions {
    /**
     * Specifies the logger to use.  Pass `false` to turn off logging.
     */
    logger?: LoggerService | LogLevel[] | boolean;
}
