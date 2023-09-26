import { appeal } from "./v1/appeal";
import { dispute } from "./v1/dispute";
import { draw } from "./v1/draw";
import { draw as drawV2 } from "./v2/draw";
import { notificationSystem } from "../../config/supabase";
import { StatusCodes } from "http-status-codes";
import { supportedChainIds, rpcUrl } from "../../config/subgraph";
import { JsonRpcProvider, Block } from "ethers";
import { Logtail } from "@logtail/node";
import { connect } from "amqplib";
const { LOGTAIL_SOURCE_TOKEN, RABBITMQ_URL } = process.env
const logtail = new Logtail(LOGTAIL_SOURCE_TOKEN);

const bots = {
    V1_COURT_DRAW: "tg-court-draw",
    V2_COURT_DRAW: "tg-court-draw-v2",
    V1_COURT_DISPUTE: "tg-court-dispute",
    V1_COURT_APPEAL: "tg-court-appeal",
};

export const notify = async () => {
    const connection = await connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    try {
        const { data, error } = await notificationSystem
            .from(`hermes-tg-counters-testing`)
            .select("*");

        if (error || !data || data.length == 0) {
            console.error(error);
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            };
        }
        let blocks: Map<number, number | null> = new Map();
        for (const chainId of supportedChainIds){
            const provider = new JsonRpcProvider(rpcUrl[chainId]);
            try {
                blocks.set(chainId, await provider.getBlock("latest").then((block: Block | null) => block ? block?.number : null));
            } catch (e){
                console.error(e);
            }
        }

        for (let row of data) {
            if (!(supportedChainIds.includes(row.network as 1 | 100))) continue; // TODO: log a warning for skipping this row

            const block = blocks.get(row.network);
            console.log('checking block');
            if (!block) continue; 

            switch (row.bot_name) {
                /*
                case bots.V1_COURT_APPEAL: {
                    const block = blocks.get(row.network);
                    if (!block) continue; 
                    rowUpdates = await appeal(bot as TelegramBotType, queue, block, row);;
                    break;
                }*/
                case bots.V1_COURT_DISPUTE: {
                    row.counter_0 = 0;
                    row = await dispute(channel, logtail, block, row);
                    break;
                }
                default: {
                    row = await draw(channel, logtail, block, row);
                    break;
                }
            }

            await notificationSystem
            .from(`hermes-tg-counters-testing`)
            .upsert(row)
        }

        await channel.close();
        await connection.close();
        
        return {
            statusCode: StatusCodes.OK,
        };
    } catch (err: any) {
        console.error(err);
        return {
            statusCode: StatusCodes.BAD_REQUEST,
        };
    }
};

if (__filename === process.argv?.[1]) {
    // Does not run when imported
    notify()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
