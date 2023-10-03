import axios from "axios";
import { getNewDisputes, supportedChainIds } from "../../../config/subgraph";
import { NewDisputesQuery } from "../../../generated/kleros-v1-notifications";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { retryPromise } from "../retry";

export const dispute = async (
    channel: Channel,
    logtail: Logtail,
    blockHeight: number,
    botData: BotData
) => {
    while (1){
        // pagination, 1000 disputes per page
        let newDisputeData = await getNewDisputes(
            botData.network as Supported<typeof supportedChainIds>,
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
        const group_id = 1350193522//Number(process.env.NOTIFICATION_CHANNEL);


        const jurorsMessages = await Promise.all(newDisputeData.disputes.map(async (draw) => {
            const metaEvidenceUri = draw.disputeID.arbitrableHistory?.metaEvidence.id ??
            await retryPromise(
                () => {
                    return fetch(`https://kleros-api.netlify.app/.netlify/functions/get-dispute-metaevidence?chainId=${botData.network}&disputeId=${draw.disputeID}`).then(async (res) => (await res.json()).metaEvidenceUri)
                },
                10000,
                3).catch((e) => {console.error("dispute metaEvidenceUri fetch failed: ", draw.disputeID)});
            console.log('finished', draw.disputeID)
            console.log('metaEvidenceUri: ', metaEvidenceUri)
            return { ...draw, message: await formatMessage(metaEvidenceUri, draw, botData.network) };
            }));

        for(const dispute of jurorsMessages){

            messages.push(
                { 
                    tg_subcribers: [group_id], 
                    messages: [{
                        cmd: "sendMessage",
                        msg: dispute.message,
                        options: 
                            {
                                parse_mode: "Markdown",
                                disable_web_page_preview: true
                            }
                        }
                    ]
                }
            );
        }
        console.log(messages.map((m) => m.messages[0].msg))
        if (messages.length != 0) {
            console.log('sending to rabbitmq')
            await sendToRabbitMQ(logtail, channel, messages);
        }
        botData.indexLast = (Number(botData.indexLast) + newDisputeData.disputes.length).toString();
        // don't bother to read more pages if there are less than 1000 disputes returned in query
        console.log('yes')
        if (newDisputeData.disputes.length < 1000) {
            break;
        }
    }
    return botData;
}

const formatMessage = async (
    metaEvidenceUri: string | void | null,
    dispute: ArrayElement<NewDisputesQuery["disputes"]>,
    chainid: number
) => {
    let name = dispute.subcourt.name;
    if (!name) {
        try {
            name = await axios.get(`https://ipfs.kleros.io/${dispute.subcourt.policy}`).then((res) => res.data.name);
        } catch (e) {
            console.log(e);
        }
    }

    let title: string | undefined;
    let description: string | undefined;
    if (metaEvidenceUri) {
        try {
            const res = await axios.get(`https://ipfs.kleros.io/${metaEvidenceUri}`).catch((e) => { console.error(e); return undefined; });
            title = res?.data?.title;
            description = res?.data?.description;
            if (!title)
                console.log(res)
        } catch (e) {
            console.error(e);
        }
    }

    return `[Dispute ${dispute.disputeID}](https://court.kleros.io/cases/${dispute.disputeID}) ${chainid == 1 ? "" : "(*gnosis*) "}created in subcourt *${name ?? `id - ${dispute.subcourt.id}`}*.${title ? `\n\n*Summary*: ${description}` : ""}`;
};