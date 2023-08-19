import * as TelegramBot from "node-telegram-bot-api";
import { start } from "../../assets/multilang.json";
import { commands } from "../../assets/multilang.json";

/*
 * /start
 */
let regexps: RegExp[] = [];

for (const lang in commands.start){
    regexps.push(new RegExp(`\/${commands.start[lang as keyof typeof commands.start]}`));
}

const callback = async (bot: TelegramBot, msg: TelegramBot.Message, lang_code: string) => {
    await bot.sendMessage(msg.from?.id!, start[lang_code as keyof typeof start]);
    return;
}

export {regexps, callback};