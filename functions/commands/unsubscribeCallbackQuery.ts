import * as TelegramBot from "node-telegram-bot-api";
import { notificationSystem } from "../../config/supabase";
import { unsubscribe } from "../../assets/multilang.json";

/*
 * /start
 */
let regexps: RegExp[] = [];

const callback = async (bot: TelegramBot, msg: TelegramBot.Message, callback_query: TelegramBot.CallbackQuery) => {
    
    console.log(callback_query);

    if (callback_query.data == "cancel"){
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        return;
    }

    await notificationSystem
        .from(`tg-notifications-hermes`)
        .delete()
        .eq('tg_user_id', msg.from?.id)
        .eq('juror_address', callback_query.data);

    await bot.sendMessage(
        msg.chat.id,
        unsubscribe.success[msg.from?.language_code as keyof typeof unsubscribe.success]
    );
    return;
}

export {regexps, callback};