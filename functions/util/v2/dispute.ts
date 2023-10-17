import { getNewDisputesV2, supportedChainIdsV2 } from "../../../config/subgraph";
import { NewDisputesV2Query } from "../../../generated/kleros-v2-notifications";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const dispute = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
) => {
    while (1){
        const newDisputeData = await getNewDisputesV2(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                blockHeight: blockHeight, 
                disputeID: Number(botData.indexLast)
            })

        if (!newDisputeData || !newDisputeData.disputes){
            logtail.error("invalid query or subgraph error.");
            break;
        }

        if (newDisputeData.disputes.length == 0) {
            break;
        }

        let messages = [];
        const group_id = testTgUserId ?? Number(process.env.NOTIFICATION_CHANNEL);

        for(const dispute of newDisputeData.disputes){

            const payload = { 
                tg_subcribers: [group_id], 
                messages: [
                    {
                        cmd: "sendAnimation",
                        file: "dispute",
                    },
                    {
                    cmd: "sendMessage",
                    msg: formatMessage(dispute),
                    options: 
                        {
                            parse_mode: "Markdown",
                            disable_web_page_preview: true
                        }
                    }
                ]
            }

            messages.push(
                { payload, signedPayload: await signer.signMessage(JSON.stringify(payload))}
            );
        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = (Number(botData.indexLast) + newDisputeData.disputes.length).toString();
        // don't bother to read more pages if there are less than 1000 disputes returned in query
        if (newDisputeData.disputes.length < 1000) {
            break;
        }
    }
    return botData;
}

const formatMessage = (
    dispute: ArrayElement<NewDisputesV2Query["disputes"]>,
) => {
    return `[Dispute ${dispute.id}](https://v2.kleros.builders/#/cases/${dispute.id}/overview) (*V2*) created in subcourt *${dispute.court.name ?? `id - ${dispute.court.id}`}*.`
};