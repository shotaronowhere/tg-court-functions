import axios from "axios";
import { isAddress } from "ethers";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";
import * as TelegramBot from "node-telegram-bot-api";
import * as NodeCacheType from "node-cache";
const tgBot = require("node-telegram-bot-api");
const NodeCache = require( "node-cache" );
const { FUNCTION_SECRET, BOT_TOKEN } = process.env
const bot: TelegramBot = new tgBot(BOT_TOKEN, {polling: false, testEnvironment: false});  
const rateLimit: NodeCacheType = new NodeCache( { stdTTL: 60, checkperiod: 90 } );
const throttleCount = 10;

const regexp = /\/start/

exports.handler = async (event: { headers: { [x: string]: string; }; body: string; }) => {
    try {
        if (event.headers["x-telegram-bot-api-secret-token"] !== FUNCTION_SECRET)
            return {statusCode: StatusCodes.UNAUTHORIZED};
        
        const json = JSON.parse(event.body)
        const msg = json?.message as TelegramBot.Message;

        if(!msg || !msg.from?.id || !msg.text)
            return {statusCode: StatusCodes.BAD_REQUEST, err: "Invalid or no message found in body."};

        const tg_user_id = msg.from?.id!;
        const msgsLastMinute = rateLimit.get(tg_user_id) as number ?? 0;

        if(msgsLastMinute > throttleCount){
            bot.sendMessage(tg_user_id, "Please wait a minute before sending another message.");
            return { statusCode: StatusCodes.OK };
        } else {
            rateLimit.set(tg_user_id, msgsLastMinute + 1);
        }

        if(msg.text.length == 42 && msg.text.startsWith("0x")){
            if(!isAddress(msg.text)){
                await bot.sendMessage(tg_user_id, "This is not a valid Ethereum address.");
                return { statusCode: StatusCodes.OK };
            } else {
                await bot.sendMessage(tg_user_id, "Thank you! I will notify you when a dispute is created for this address. You can change the address at any time by sending me a new one.");
                await datalake.from(`tg-notifications-hermes`).upsert({tg_user_id: tg_user_id, juror_address: msg.text})
                return { statusCode: StatusCodes.OK };
            }
        }

        // check regex
        if(regexp.test(msg.text)){
            await bot.sendMessage(tg_user_id, "Hi! My name is Hermes, the Kleros Messenger.\n\nPlease send me the juror address for which you would like me to notify you about.");
        }

        return { statusCode: StatusCodes.OK };
    } catch (e) {
        console.log(e);
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({ error: e }),
        };
    }
};