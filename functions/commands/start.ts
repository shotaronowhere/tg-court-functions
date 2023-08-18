import * as TelegramBot from "node-telegram-bot-api";

/*
 * /start
 */
const regexp = /\/start/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(msg.from?.id!,
        "Hi! My name is Hermes, the Kleros Messenger. I deliver jury summons from the Kleros court.\n\n\`/subscribe\` or \`/unsubscribe\` at anytime.",
        {parse_mode: "Markdown"});
    return;
}

export {regexp, callback};