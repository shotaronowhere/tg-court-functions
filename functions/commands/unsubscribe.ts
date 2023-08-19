import * as TelegramBot from "node-telegram-bot-api";
import { notificationSystem } from "../../config/supabase";
import { unsubscribe } from "../../assets/multilang.json";

/*
 * /start
 */
const regexp = /\/unsubscribe/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {

    const jurors = await notificationSystem
    .from(`tg-notifications-hermes`)
    .select("juror_address")
    .eq('tg_user_id', msg.from?.id);

    console.log(jurors);

    if (!jurors?.data)
        return;

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
            text: 'cancel',
            callback_data: 'cancel'
        }]
    );

    await bot.sendMessage(
        msg.chat.id, 
        "which juror do you want to unsubscribe?",
        {
            parse_mode: 'Markdown',
            reply_markup: {inline_keyboard: subscriptions}
        }
    );
    
    /*await notificationSystem
        .from(`tg-notifications-hermes`)
        .delete()
        .eq('tg_user_id', msg.from?.id);*/
    return;
}

export {regexp, callback};