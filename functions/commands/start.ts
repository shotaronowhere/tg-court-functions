import * as TelegramBot from "node-telegram-bot-api";

/*
 * /start
 */
const regexp = /\/start/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(msg.from?.id!, "Hi! My name is Hermes, the Kleros Messenger.\n\nPlease send me the juror address or ens for which you would like me to notify you about.");
    return;
}

export {regexp, callback};