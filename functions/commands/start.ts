import * as TelegramBot from "node-telegram-bot-api";
import { start } from "../../assets/multilang.json";

/*
 * /start
 */
const regexp = /\/start/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(msg.from?.id!, start[msg.from?.language_code as keyof typeof start]);
    return;
}

export {regexp, callback};