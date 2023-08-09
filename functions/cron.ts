import axios from "axios";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";
import { Handler, schedule } from "@netlify/functions";

const headers = {
    "Access-Control-Allow-Origin": "*",
};

const handler: Handler = async () => {
    try{
        const { data, error } = await datalake
        .from(`bot-block-heights`)
        .select("*")
        .eq("bot_name", `tg-court-functions`)
        .eq("network", "ethereum")

        if (error)
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                body: JSON.stringify({ error: error.message }),
            };

        await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
            chat_id: process.env.NOTIFICATION_CHANNEL,
            text: "New Kleros Dispute!" + JSON.stringify(data),
            });
        
        const disputeQuery = `
        {
            disputes(first: 1000, where: {startTime_gt: 1641899928}) {
            id
            startTime
            }
        }`

        return {
            headers,
            statusCode: StatusCodes.OK
        };
    } catch (err: any) {
        return {
          statusCode: StatusCodes.BAD_REQUEST,
          body: JSON.stringify({ error: err.message }),
        };
      }

};

module.exports.handler = schedule("* * * * *", handler);