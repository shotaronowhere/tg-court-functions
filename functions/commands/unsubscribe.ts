import * as TelegramBot from "node-telegram-bot-api";
import { notificationSystem } from "../../config/supabase";
import { unsubscribe } from "../../assets/multilang.json";
import { commands } from "../../assets/multilang.json";

/*
 * /start
 */
let regexps: RegExp[] = [];

for (const lang in commands.unsubscribe){
    regexps.push(new RegExp(`\/${commands.unsubscribe[lang as keyof typeof commands.unsubscribe]}`));
}
const callback = async (bot: TelegramBot, msg: TelegramBot.Message, lang_code: string) => {

    const jurors = await notificationSystem
    .from(`tg-juror-subscriptions`)
    .select("juror_address")
    .eq('tg_user_id', msg.from?.id);

    if (!jurors?.data || jurors?.data?.length == 0){
        await bot.sendMessage(
            msg.chat.id,
            unsubscribe.not_found[lang_code as keyof typeof unsubscribe.not_found]
        );
        return;
    }

    let subscriptions = []

    for (const juror of jurors?.data!) {
        const fullAddress = juror.juror_address as string;
        const shortAddress = fullAddress.slice(0, 6) + "..." + fullAddress.slice(-4);
        subscriptions.push(
            [{
                text: shortAddress,
                callback_data: fullAddress
            }]
        );
    }

    subscriptions.push(
        [{
            text: unsubscribe.cancel[lang_code as keyof typeof unsubscribe.cancel],
            callback_data: 'cancel'
        }]
    );

    await bot.sendMessage(
        msg.chat.id, 
        unsubscribe.select[lang_code as keyof typeof unsubscribe.select],
        {
            parse_mode: 'Markdown',
            reply_markup: {inline_keyboard: subscriptions}
        }
    );
    
    return;
}

export {regexps, callback};