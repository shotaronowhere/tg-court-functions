import { appeal } from "./v1/appeal";
import { dispute } from "./v1/dispute";
import { draw } from "./v1/draw";
import { vote } from "./v1/vote";
import { commit } from "./v1/commit";
import { commitReminder } from "./v1/commitReminder";
import { voteReminder } from "./v1/voteReminder";
import { draw as drawV2 } from "./v2/draw";
import { notificationSystem } from "../../config/supabase";
import { StatusCodes } from "http-status-codes";
import { supportedChainIds, rpcUrl } from "../../config/subgraph";
import { JsonRpcProvider, Block } from "ethers";
import { Logtail } from "@logtail/node";
import { connect } from "amqplib";
import { appealReminder } from "./v1/appealReminder";
const { LOGTAIL_SOURCE_TOKEN, RABBITMQ_URL } = process.env
const logtail = new Logtail(LOGTAIL_SOURCE_TOKEN);

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
                blocks.set(chainId, await provider.getBlock("finalized").then((block: Block | null) => block ? block?.number : null));
            } catch (e){
                console.error(e);
            }
        }

        for (let row of data) {
            if (!(supportedChainIds.includes(row.network as 1 | 100))) continue; // TODO: log a warning for skipping this row

            const block = blocks.get(row.network);
            if (!block) continue; 

            switch (row.bot_name) {
                case "court-dispute": {
                    row = await dispute(channel, logtail, block, row);
                    break;
                }
                case "court-draw": {
                    row = await draw(channel, logtail, block, row);
                    break;
                }
                case "court-commit": {
                    row = await commit(channel, logtail, block, row);
                    break;
                }
                case "court-commit-reminder": {
                    row = await commitReminder(channel, logtail, block, row);
                    break;
                }
                case "court-vote": {
                    row = await vote(channel, logtail, block, row);
                    break;
                }
                case "court-vote-reminders": {
                    row = await voteReminder(channel, logtail, block, row);
                    break;
                }
                case "court-appeal": {
                    row.indexLast = "0"
                    row = await appeal(channel, logtail, block, row);
                    break;
                }
                case "court-appeal-reminders": {
                    row = await appealReminder(channel, logtail, block, row);
                    break;
                }
                default: {
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
