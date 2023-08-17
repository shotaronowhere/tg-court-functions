import * as TelegramBot from "node-telegram-bot-api";
import { isAddress, JsonRpcProvider, WebSocketProvider } from "ethers";
import { datalake } from "../../config/supabase";
/*
 * /subscribe
 */
const regexp = /^\/subscribe/
const regexpFull = /^\/subscribe (.+)/

const callback = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const match = msg.text!.match(regexpFull);
    if (!match){
        await bot.sendMessage(msg.chat.id, 
            "Please send me the juror address or ens for which you would like me to notify you about. eg \`/subscribe 0xa1f...2fa\` or \`/subscribe vb.eth\`");
        return;
    }

    let address: string | undefined = undefined;

    if(match[0].length == 42 && match[0].startsWith("0x")){
        if(!isAddress(msg.text)){
            await bot.sendMessage(msg.chat.id, "This is not a valid Ethereum address.");
            return;
        }
        address = msg.text;
    } else if(match[0].endsWith(".eth")){
        const provider = new JsonRpcProvider(process.env.RPC_URL_MAINNET);
        const resp = await provider.resolveName(match[0])
        if(!resp){
            await bot.sendMessage(msg.chat.id, "This ENS name does not resolve to an address.");
            return
        } 
        address = resp;
    }

    await bot.sendMessage(msg.chat.id, "Thank you! I will notify you when a dispute is created for this address. You can change the address at any time by sending me a new one.");
    await datalake.from(`tg-notifications-hermes`).upsert({tg_user_id: msg.from?.id, juror_address: msg.text})
    return;
}

export {regexp, callback};