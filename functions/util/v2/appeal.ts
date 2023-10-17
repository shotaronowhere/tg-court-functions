import { getAppealableDisputesV2, supportedChainIdsV2 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsAppealV2Query } from "../../../generated/kleros-v2-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const appealV2 = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsAppeal = await getAppealableDisputesV2(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        
        if (!jurorsAppeal || !jurorsAppeal.disputes){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsAppeal.disputes.length == 0) {
            break;
        }

        const jurors: string[] = [];
        for (const dispute of jurorsAppeal.disputes) {
            for (const juror of dispute.jurors) {
                jurors.push(getAddress(juror.id));
            }
        }
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        const disputeMessages = jurorsAppeal.disputes.map((dispute) => {
            return { ...dispute, message: formatMessage(dispute, botData.network)};
          });

        let messages = [];
        for (const dispute of disputeMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                for (const juror of dispute.jurors) {
                    tg_users.data.find((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.id));
                    // get_subscribers returns sorted by juror_address
                    let index = tg_users.data.findIndex((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.id));
                    if (index == -1) continue; 
                    while (tg_users.data[index]?.juror_address == getAddress(juror.id)){
                        tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                        index++;
                    }
                }
            }

            if (tg_subcribers.length == 0) continue;
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = { 
                tg_subcribers, 
                messages: [
                    {
                    cmd: "sendAnimation",
                    file: "appeal",
                    },{
                    cmd: "sendMessage",
                    msg: dispute.message,
                    options: 
                        {
                            parse_mode: "Markdown",
                        }
                    }
                ]
            }
            messages.push({ payload, signedPayload: await signer.signMessage(JSON.stringify(payload))});
        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = (Number(jurorsAppeal.disputes[jurorsAppeal.disputes.length - 1].periodNotificationIndex) + 1).toString();
        if (jurorsAppeal.disputes.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    appeal: ArrayElement<JurorsAppealV2Query["disputes"]>,
    network: number
): string => {
    const secRemaining = Math.floor(Number(appeal.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    return `[Dispute ${appeal.id}](https://court.kleros.io/cases/${
        appeal.id
    }) (*V2*) concluded it's current round!
    
If you think the ruling is incorrect, you can request an [appeal](https://court.kleros.io/cases/${appeal.id}). There is ${timeRemaining}left to appeal.`
};
