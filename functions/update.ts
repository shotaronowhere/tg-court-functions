import axios from "axios";

exports.handler = async (event: any) => {
    console.log("Received an update from Telegram!", event.body);

    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    chat_id: process.env.NOTIFICATION_CHANNEL,
    text: "New Kleros Dispute!",
    });

    return { statusCode: 200 };
};