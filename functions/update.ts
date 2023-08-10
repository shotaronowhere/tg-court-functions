import axios from "axios";

exports.handler = async (event: any) => {
    console.log("Received an update from Telegram!", event.body);

    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    chat_id: JSON.parse(event.body).message.chat.id,
    text: "I got your message!",
    });

    return { statusCode: 200 };
};