import * as TelegramBot from "node-telegram-bot-api";
import { notificationSystem } from "../../config/supabase";
import { unsubscribe } from "../../assets/multilang.json";

/*
 * /start
 */
let regexps: RegExp[] = [];

const callback = async (bot: TelegramBot, callback_query: TelegramBot.CallbackQuery, lang_code: string) => {
    
    if (callback_query.data == "cancel"){
        await bot.deleteMessage(callback_query.message?.chat?.id!, callback_query.message?.message_id!);
        return;
    }

    await notificationSystem
        .from(`tg-juror-subscriptions`)
        .delete()
        .eq('tg_user_id', callback_query.message?.chat?.id!)
        .eq('juror_address', callback_query.data);

    await bot.sendMessage(
        callback_query.message?.chat?.id!,
        unsubscribe.success[lang_code as keyof typeof unsubscribe.success]
    );

    await bot.deleteMessage(callback_query.message?.chat?.id!, callback_query.message?.message_id!);
    return;
}

export {regexps, callback};