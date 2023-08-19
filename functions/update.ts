import { StatusCodes } from "http-status-codes";
import TelegramBot = require("node-telegram-bot-api");
import NodeCache = require( "node-cache" );
import * as subscribe from "./commands/subscribe";
import * as unsubscribe from "./commands/unsubscribe";
import * as unsubscribeCallbackQuery from "./commands/unsubscribeCallbackQuery";
import * as start from "./commands/start";
import { lang_support } from "../assets/multilang.json";

const { FUNCTION_SECRET, BOT_TOKEN } = process.env
const bot = new TelegramBot(BOT_TOKEN, {polling: false});  

// cache is unreliable (since cloud provider kills instance when idle)
// however sufficient for basic rate limiting
// 1 minute cache, 30 second check
const rateLimit = new NodeCache( { stdTTL: 60, checkperiod: 30 } );
const throttleCount = 10;

const commands: {regexps: RegExp[], callback: any}[] = [
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
        
        const json = JSON.parse(event.body) as TelegramBot.Update;
        console.log(json)
        if (!json){
            console.error("JSON parsing error.")
            // avoid Telegram API retry by sending OK status
            return { statusCode: StatusCodes.OK };
        }

        let msg = json?.message as TelegramBot.Message;
        let callback_query = json?.callback_query as TelegramBot.CallbackQuery;

        if(!(msg || callback_query) || !(msg?.chat?.type == "private" || callback_query?.message?.chat.type == "private")){
            console.error("Invalid or no message found in body.")
            // avoid Telegram API retry by sending OK status
            return { statusCode: StatusCodes.OK };
        }

        let lang_code = msg?.from?.language_code! || callback_query.from.language_code || "en";
        if (!lang_support[lang_code as keyof typeof lang_support])
            lang_code = "en";

        if (callback_query){
            await unsubscribeCallbackQuery.callback(bot as any, callback_query, lang_code);
            return { statusCode: StatusCodes.OK };
        }

        const tg_user_id = msg.from?.id!;
        const msgsLastMinute = rateLimit.get(tg_user_id) as number ?? 0;

        if(msgsLastMinute > throttleCount){
            return { statusCode: StatusCodes.OK };
        } else {
            rateLimit.set(tg_user_id, msgsLastMinute + 1);
        }

        if (!msg.text){
            console.error("No text found in message.")
            // avoid Telegram API retry by sending OK status
            return { statusCode: StatusCodes.OK };
        }

        for (const command of commands){
            for (const regexp of command.regexps){
                if (regexp.test(msg.text)){
                    await command.callback(bot, msg, lang_code);
                    return { statusCode: StatusCodes.OK };
                }
            }
        }

    } catch (e) {
        console.log(e);
        // avoid Telegram API retry by sending OK status
        return { statusCode: StatusCodes.OK };
    }
};