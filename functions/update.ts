import axios from "axios";
import { isAddress } from "ethers";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";

import * as TelegramBot from "node-telegram-bot-api";
const tgBot = require("node-telegram-bot-api");
const { FUNCTION_SECRET, BOT_TOKEN } = process.env
const bot: TelegramBot = new tgBot(BOT_TOKEN, {polling: false, testEnvironment: false});  
const regexp = /\/start/

let counter = 0;

exports.handler = async (event: { headers: { [x: string]: string; }; body: string; }) => {
    try {
        console.log(event)
        if (event.headers["x-telegram-bot-api-secret-token"] !== FUNCTION_SECRET)
            return {statusCode: StatusCodes.UNAUTHORIZED};
            
        const json = JSON.parse(event.body)
        const msg = json?.message as TelegramBot.Message;

        if(!msg || !msg.from?.id || !msg.text)
            return {statusCode: StatusCodes.BAD_REQUEST, err: "Invalid or no message found in body."};

        const tg_user_id = msg.from?.id!;

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

        counter++;
        console.log(counter);

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