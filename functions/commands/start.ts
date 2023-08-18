import * as TelegramBot from "node-telegram-bot-api";

/*
 * /start
 */
const regexp = /\/start/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(msg.from?.id!,
        "Hi! My name is Hermes, the Kleros Messenger.\n\nI deliver jury summons from the Kleros court. You can \`/susbcribe\` to your juror address and \`/unsubscribe\` at anytime.");
    return;
}

export {regexp, callback};