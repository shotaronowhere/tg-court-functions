import axios from "axios";
const { schedule } = require('@netlify/functions');

exports.handler = schedule('* * * * *', async () => {

    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    chat_id: process.env.NOTIFICATION_CHANNEL,
    text: "New Kleros Dispute!",
    });

    console.log('hello')

    return {
        statusCode: 200,
    };
});