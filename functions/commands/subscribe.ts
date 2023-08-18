import * as TelegramBot from "node-telegram-bot-api";
import { isAddress, JsonRpcProvider, WebSocketProvider } from "ethers";
import { datalake } from "../../config/supabase";
/*
 * /subscribe
 */
const regexp = /^\/subscribe/
const regexpFull = /^\/subscribe (.+)/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    console.log("subscribe", msg.text);
    const match = msg.text!.match(regexpFull);
    console.log(match)
    if (!match){
        await bot.sendMessage(msg.chat.id, 
            "Please specify a juror, \`/subscribe 0xa1f...2fa\` or \`/subscribe vb.eth\`.");
        return;
    }

    let address: string | undefined = undefined;

    if(match[0].length == 42 && match[0].startsWith("0x")){
        if(!isAddress(msg.text)){
            await bot.sendMessage(msg.chat.id, "Not a valid address.");
            return;
        }
        address = msg.text;
    } else if(match[1].endsWith(".eth")){
        const provider = new JsonRpcProvider(process.env.RPC_URL_MAINNET);
        const resp = await provider.resolveName(match[1])
        if(!resp){
            await bot.sendMessage(msg.chat.id, "ENS name does not resolve to an address.");
            return
        } 
        address = resp;
    }

    await bot.sendMessage(msg.chat.id, "Thank you! I will notify you when a dispute is created for this address. You can change the address at any time by sending me a new one.");
    await datalake.from(`tg-notifications-hermes`).upsert({tg_user_id: msg.from?.id, juror_address: msg.text})
    return;
}

export {regexp, callback};