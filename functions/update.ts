import axios from "axios";
import { isAddress } from "ethers";
import { datalake } from "../config/supabase";

const regexp = /\/start/

exports.handler = async (event: any) => {
    console.log(event.body)
    const msg = JSON.parse(event.body).message;

    const tg_user_id = msg.from.id;

    if(msg.text.length == 42 && msg.text.startsWith("0x")){
        if(!isAddress(msg.text)){
            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: tg_user_id,
                text: "This is not a valid Ethereum address.",
                });
            return { statusCode: 200 };
        } else {
            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: tg_user_id,
                text: "I will notify you when a dispute is created for this address. You can change the address at any time by sending me a new one.",
                });
            await datalake.from(`tg-notifications-hermes`).upsert({tg_user_id: tg_user_id, juror_address: msg.text})
            return { statusCode: 200 };
        }
    }

        // check regex
        if(regexp.test(msg.text)){
            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: JSON.parse(event.body).message.chat.id,
                text: "Hi! My name is Hermes, the Kleros Messenger.\n\nPlease send me the juror address for which you would like me to notify you about.",
            });
        }

    return { statusCode: 200 };
};