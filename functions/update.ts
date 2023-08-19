import { StatusCodes } from "http-status-codes";
import TelegramBot = require("node-telegram-bot-api");
import NodeCache = require( "node-cache" );
import * as subscribe from "./commands/subscribe";
import * as unsubscribe from "./commands/unsubscribe";
import * as start from "./commands/start";

const { FUNCTION_SECRET, BOT_TOKEN } = process.env
const bot = new TelegramBot(BOT_TOKEN, {polling: false});  

// cache is unreliable (since cloud provider kills instance when idle)
// however sufficient for basic rate limiting
// 1 minute cache, 30 second check
const rateLimit = new NodeCache( { stdTTL: 60, checkperiod: 30 } );
const throttleCount = 10;

const commands: {regexp: RegExp, callback: any}[] = [
    start,
    subscribe,
    unsubscribe
];

exports.handler = async (event: { headers: { [x: string]: string; }; body: string; }) => {
    try {
        if (event.headers["x-telegram-bot-api-secret-token"] !== FUNCTION_SECRET){
            console.error("Unauthorized")
            return {statusCode: StatusCodes.UNAUTHORIZED};
        }
        
        const json = JSON.parse(event.body)
        console.log(json)
        const msg = json?.message as TelegramBot.Message;

        if(!msg || !msg.from?.id || !msg.text || msg.chat.type !== "private"){
            console.error("Invalid or no message found in body.")
            // avoid Telegram API retry by sending OK status
            return { statusCode: StatusCodes.OK };
        }

        const tg_user_id = msg.from?.id!;
        const msgsLastMinute = rateLimit.get(tg_user_id) as number ?? 0;

        if(msgsLastMinute > throttleCount){
            return { statusCode: StatusCodes.OK };
        } else {
            rateLimit.set(tg_user_id, msgsLastMinute + 1);
        }

        for (const command of commands){
            if (command.regexp.test(msg.text)){
                await command.callback(bot, msg);
                return { statusCode: StatusCodes.OK };
            }
        }

    } catch (e) {
        console.log(e);
        // avoid Telegram API retry by sending OK status
        return { statusCode: StatusCodes.OK };
    }
};