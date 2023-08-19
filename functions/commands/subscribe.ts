import * as TelegramBot from "node-telegram-bot-api";
import { isAddress, getAddress, JsonRpcProvider } from "ethers";
import { notificationSystem } from "../../config/supabase";
import { subscribe } from "../../assets/multilang.json";
import { commands } from "../../assets/multilang.json";

/*
 * /subscribe
 */

let regexps: RegExp[] = [];

for (const lang in commands.subscribe){
    regexps.push(new RegExp(`\/${commands.subscribe[lang as keyof typeof commands.subscribe]}`));
}

const regexpFull = /^\/(.+) (.+)/;
const max_subscriptions = 10;

const callback = async (bot: TelegramBot, msg: TelegramBot.Message, lang_code: string) => {
    const match = msg.text!.match(regexpFull);
    if (!match){
        await bot.sendMessage(
            msg.chat.id, 
            subscribe.no_match[lang_code as keyof typeof subscribe.no_match],
            {parse_mode: "Markdown"}
        );
        return;
    }

    let address: string | undefined = undefined;

    if(match[2].startsWith("0x")){
        if(!isAddress(match[2])){
            await bot.sendMessage(
                msg.chat.id, 
                subscribe.not_address[lang_code as keyof typeof subscribe.not_address]
            );
            return;
        }
        address = getAddress(match[2]);
    } else if(match[2].endsWith(".eth")){
        const provider = new JsonRpcProvider(process.env.RPC_URL_MAINNET);
        const resp = await provider.resolveName(match[2]);
        if(!resp){
            await bot.sendMessage(
                msg.chat.id, 
                subscribe.not_ens[lang_code as keyof typeof subscribe.not_ens]
            );
            return;
        } 
        address = resp;
    } else {
        await bot.sendMessage(
            msg.chat.id, 
            subscribe.invalid[lang_code as keyof typeof subscribe.invalid],
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
            subscribe.max_subs[lang_code as keyof typeof subscribe.max_subs]
        );
        return;
    }

    await bot.sendMessage(
        msg.chat.id, 
        subscribe.thankyou[lang_code as keyof typeof subscribe.thankyou]
    );

    await notificationSystem
        .from(`tg-notifications-hermes`)
        .upsert({tg_user_id: msg.from?.id, juror_address: address});

    return;
}

export {regexps, callback};