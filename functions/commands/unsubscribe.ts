import * as TelegramBot from "node-telegram-bot-api";
import { datalake } from "../../config/supabase";

/*
 * /start
 */
const regexp = /\/unsubscribe/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(msg.chat.id, "You are unsubscribed from all notifications.");
    await datalake.from(`tg-notifications-hermes`).delete().eq('tg_user_id', msg.from?.id)
    return;
}

export {regexp, callback};