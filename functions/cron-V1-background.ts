import { appeal } from "./util/v1/appeal";
import { dispute} from "./util/v1/dispute";
import { draw} from "./util/v1/draw";
import { notificationSystem } from "../config/supabase";
import { Handler, schedule } from "@netlify/functions";
import { StatusCodes } from "http-status-codes";

const handler: Handler = async () => {
    try{
        const { data, error }  = await notificationSystem
        .from(`hermes-tg-counters`)
        .select("*")
        .order("bot_name", { ascending: true })
        
        if (error || !data || data.length == 0){
            console.error(error)
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            };
        }

        for (const row of data){
            console.log(row)
            switch(row.bot_name){
                case "tg-court-appeal": {
                    const timestampUpdate = await appeal(row.counter, row.chainid)
                    await notificationSystem.from(`hermes-tg-counters`).update({counter: timestampUpdate}).eq("bot_name", `tg-court-appeal`).eq("chainid", row.chainid)
                    break;
                }
                case "tg-court-dispute": {
                    const disputeIDUpdate = await dispute(row.counter, row.chainid)
                    await notificationSystem.from(`hermes-tg-counters`).update({counter: disputeIDUpdate}).eq("bot_name", `tg-court-dispute`).eq("chainid", row.chainid)
                    break;
                }
                default: {
                    const timestampUpdate = await draw(row.counter, row.chainid)
                    await notificationSystem.from(`hermes-tg-counters`).update({counter: timestampUpdate}).eq("bot_name", `tg-court-draw`).eq("chainid", row.chainid)
                    break;
                }
            }
        }

        return {
            statusCode: StatusCodes.OK
        };
    } catch (err: any) {
        console.log(err)
        return {
          statusCode: StatusCodes.BAD_REQUEST
        };
      }
};

module.exports.handler = schedule("@hourly", handler);