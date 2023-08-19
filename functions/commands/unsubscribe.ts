import * as TelegramBot from "node-telegram-bot-api";
import { notificationSystem } from "../../config/supabase";
import { unsubscribe } from "../../assets/multilang.json";

/*
 * /start
 */
const regexp = /\/unsubscribe/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    await bot.sendMessage(
        msg.chat.id, 
        unsubscribe[msg.from?.language_code as keyof typeof unsubscribe]
    );
    await notificationSystem
        .from(`tg-notifications-hermes`)
        .delete()
        .eq('tg_user_id', msg.from?.id);
    return;
}

export {regexp, callback};