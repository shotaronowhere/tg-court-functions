import { appeal } from "./v1/appeal";
import { appealV2 } from "./v2/appeal";
import { dispute } from "./v1/dispute";
import { dispute as disputeV2} from "./v2/dispute";
import { draw } from "./v1/draw";
import { drawV2 } from "./v2/draw";
import { period } from "./v1/period";
import { periodV2 } from "./v2/period";
import { periodReminder } from "./v1/periodReminder";
import { periodReminderV2 } from "./v2/periodReminder";
import { appealReminder } from "./v1/appealReminder";
import { appealReminderV2 } from "./v2/appealReminder";
import { notificationSystem } from "../../config/supabase";
import { Supported } from "../../types";
import { StatusCodes } from "http-status-codes";
import { supportedChainIdsV1, supportedChainIdsV2, rpcUrl } from "../../config/subgraph";
import { JsonRpcProvider, Block } from "ethers";
import { Logtail } from "@logtail/node";
import { connect } from "amqplib";
import { Wallet } from 'ethers';
const { LOGTAIL_SOURCE_TOKEN, RABBITMQ_URL, SIGNER_KEY, TEST_TG_USER_ID } = process.env
const logtail = new Logtail(LOGTAIL_SOURCE_TOKEN);
// Getting private key from environment variable

const signer = new Wallet(SIGNER_KEY);
const testTgUserId = TEST_TG_USER_ID;

export const notify = async () => {
    const connection = await connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    try {
        const { data, error } = await notificationSystem
            .from(`hermes-counters`)
            .select("*");


        if (error || !data || data.length == 0) {
            console.error(error);
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            };
        }
        let blocks: Map<number, number | null> = new Map();
        for (const chainId of supportedChainIdsV1){
            const provider = new JsonRpcProvider(rpcUrl[chainId]);
            try {
                blocks.set(chainId, await provider.getBlock("finalized").then((block: Block | null) => block ? block?.number : null));
            } catch (e){
                console.error(e);
            }
        }

        for (const chainId of supportedChainIdsV2){
            const provider = new JsonRpcProvider(rpcUrl[chainId]);
            try {
                blocks.set(chainId, await provider.getBlock("finalized").then((block: Block | null) => block ? block?.number : null));
            } catch (e){
                console.error(e);
            }
        }

        for (let row of data) {            
            const isV1 = supportedChainIdsV1.includes(row.network as Supported<typeof supportedChainIdsV1>)
            const isV2 = supportedChainIdsV2.includes(row.network as Supported<typeof supportedChainIdsV2>)

            if (!(isV1 || isV2)) continue; // TODO: log a warning for skipping this row

            const block = blocks.get(row.network);
            if (!block) {
                console.error(`Block not found for chainId ${row.network}`);
                continue; 
            }
            switch (row.bot_name) {
                case "court-dispute": {
                    const notify = isV1 ? dispute : disputeV2;
                    row = await notify(channel, logtail, signer, block, row, testTgUserId);
                    break;
                }
                case "court-draw": {
                    const notify = isV1 ? draw : drawV2;
                    row = await notify(channel, logtail, signer, block, row, testTgUserId);
                    break;
                }
                case "court-commit": {
                    const notify = isV1 ? period : periodV2;
                    row = await notify(channel, logtail, signer, block, row, isV1? "COMMIT" : "commit", testTgUserId);
                    break;
                }
                case "court-commit-reminder": {
                    const notify = isV1 ? periodReminder : periodReminderV2;
                    row = await notify(channel, logtail, signer, block, row, isV1? "COMMIT" : "commit", testTgUserId);
                    break;
                }
                case "court-vote": {
                    const notify = isV1 ? period : periodV2;
                    row = await notify(channel, logtail, signer, block, row, isV1? "VOTE" : "vote", testTgUserId);
                    break;
                }
                case "court-vote-reminder": {
                    const notify = isV1 ? periodReminder : periodReminderV2;
                    row = await notify(channel, logtail, signer, block, row, isV1? "VOTE" : "vote", testTgUserId);
                    break;
                }
                case "court-appeal": {
                    const notify = isV1 ? appeal : appealV2;
                    row = await notify(channel, logtail, signer, block, row, testTgUserId);
                    break;
                }
                case "court-appeal-reminders": {
                    const notify = isV1 ? appealReminder : appealReminderV2;
                    row = await notify(channel, logtail, signer, block, row, testTgUserId);
                    break;
                }
                default: {
                    continue;
                }
            }

            await notificationSystem
            .from(`hermes-counters`)
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
