import { appeal } from "./v1/appeal";
import { dispute } from "./v1/dispute";
import { draw } from "./v1/draw";
import { draw as drawV2 } from "./v2/draw";
import { notificationSystem } from "../../config/supabase";
import { StatusCodes } from "http-status-codes";
import { arbitrumGoerli } from "viem/chains";
import { supportedChainIds } from "../../config/subgraph";
import { ArrayElement } from "../../types";

const bots = {
    V1_COURT_DRAW: "tg-court-draw",
    V2_COURT_DRAW: "tg-court-draw-v2",
    V1_COURT_DISPUTE: "tg-court-dispute",
    V1_COURT_APPEAL: "tg-court-appeal",
};

export const notify = async () => {
    try {
        const { data, error } = await notificationSystem
            .from(`hermes-tg-counters`)
            .select("*")
            .like("bot_name", "%-v2") // WARNING: v2 only
            .order("bot_name", { ascending: true });

        if (error || !data || data.length == 0) {
            console.error(error);
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            };
        }

        for (const row of data) {
            console.log(row);
            if (!row.counter) continue; // TODO: log a warning for skipping this row
            if (!(row.chainid in supportedChainIds)) continue; // TODO: log a warning for skipping this row
            const chainId =
                supportedChainIds[
                    row.chainid as ArrayElement<typeof supportedChainIds>
                ];
            switch (row.bot_name) {
                case bots.V1_COURT_APPEAL: {
                    const timestampUpdate = await appeal(row.counter, chainId);
                    await notificationSystem
                        .from(`hermes-tg-counters`)
                        .update({ counter: timestampUpdate })
                        .eq("bot_name", bots.V1_COURT_APPEAL)
                        .eq("chainid", chainId);
                    break;
                }
                case bots.V1_COURT_DISPUTE: {
                    const disputeIDUpdate = await dispute(row.counter, chainId);
                    await notificationSystem
                        .from(`hermes-tg-counters`)
                        .update({ counter: disputeIDUpdate })
                        .eq("bot_name", bots.V1_COURT_DISPUTE)
                        .eq("chainid", chainId);
                    break;
                }
                case bots.V2_COURT_DRAW: {
                    const blockNumberUpdate = await drawV2(
                        BigInt(row.counter + 1)
                    );
                    await notificationSystem
                        .from(`hermes-tg-counters`)
                        .update({ counter: Number(blockNumberUpdate) }) // Dangerous if higher than Number.MAX_SAFE_INTEGER
                        .eq("bot_name", bots.V2_COURT_DRAW)
                        .eq("chainid", 0 /* arbitrumGoerli.id */); // because the Supabase schema uses an int2
                    break;
                }
                default: {
                    const timestampUpdate = await draw(row.counter, chainId);
                    await notificationSystem
                        .from(`hermes-tg-counters`)
                        .update({ counter: timestampUpdate })
                        .eq("bot_name", bots.V1_COURT_DRAW)
                        .eq("chainid", chainId);
                    break;
                }
            }
        }

        return {
            statusCode: StatusCodes.OK,
        };
    } catch (err: any) {
        console.log(err);
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
