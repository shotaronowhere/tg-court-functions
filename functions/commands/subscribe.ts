import * as TelegramBot from "node-telegram-bot-api";
import { isAddress, getAddress, JsonRpcProvider } from "ethers";
import { notificationSystem } from "../../config/supabase";
import { subscribe } from "../../assets/multilang.json";

/*
 * /subscribe
 */
const regexp = /^\/subscribe/;
const regexpFull = /^\/subscribe (.+)/;
const max_subscriptions = 10;

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const match = msg.text!.match(regexpFull);
    if (!match){
        await bot.sendMessage(
            msg.chat.id, 
            subscribe.no_match[msg.from?.language_code as keyof typeof subscribe.no_match],
            {parse_mode: "Markdown"}
        );
        return;
    }

    let address: string | undefined = undefined;

    if(match[1].startsWith("0x")){
        if(!isAddress(match[1])){
            await bot.sendMessage(
                msg.chat.id, 
                subscribe.not_address[msg.from?.language_code as keyof typeof subscribe.not_address]
            );
            return;
        }
        address = getAddress(match[1]);
    } else if(match[1].endsWith(".eth")){
        const provider = new JsonRpcProvider(process.env.RPC_URL_MAINNET);
        const resp = await provider.resolveName(match[1]);
        if(!resp){
            await bot.sendMessage(
                msg.chat.id, 
                subscribe.not_ens[msg.from?.language_code as keyof typeof subscribe.not_ens]
            );
            return;
        } 
        address = resp;
    } else {
        await bot.sendMessage(
            msg.chat.id, 
            subscribe.no_match[msg.from?.language_code as keyof typeof subscribe.no_match],
            {parse_mode: "Markdown"}
        );
        return;
    }

    const count = await notificationSystem
        .from(`tg-notifications-hermes`)
        .select("*", { count: 'exact', head: true })
        .eq("tg_user_id", msg.from?.id);

    if (!count)
        return;

    if (count.count! > max_subscriptions){
        await bot.sendMessage(
            msg.chat.id, 
            subscribe.max_subs[msg.from?.language_code as keyof typeof subscribe.max_subs]
        );
        return;
    }

    await bot.sendMessage(
        msg.chat.id, 
        subscribe.thankyou[msg.from?.language_code as keyof typeof subscribe.thankyou]
    );

    await notificationSystem
        .from(`tg-notifications-hermes`)
        .upsert({tg_user_id: msg.from?.id, juror_address: address});

    return;
}

export {regexp, callback};