import { getAppealRemindersV2, supportedChainIdsV2 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsAppealReminderV2Query } from "../../../generated/kleros-v2-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const appealReminderV2 = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const timeNow = Math.floor(Date.now() / 1000);
        const reminderDeadline = timeNow + 86400; // 24 hours
        const jurorsAppealReminder = await getAppealRemindersV2(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                timeNow,
                reminderDeadline,
                blockHeight,
                idLast: botData.indexLast,
                blockLast: botData.blockHeight
            }
        )
        
        if (!jurorsAppealReminder || !jurorsAppealReminder.disputes){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsAppealReminder.disputes.length == 0) {
            botData.indexLast = "0";
            botData.blockHeight = blockHeight;
            break;
        }

        const jurors: string[] = [];
        for (const dispute of jurorsAppealReminder.disputes) {
            for (const juror of dispute.jurors) {
                jurors.push(getAddress(juror.id));
            }
        }
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})
        const disputeMessages = jurorsAppealReminder.disputes.map((dispute) => {
            return { ...dispute, message: formatMessage(dispute)};
          });
          

        if (!tg_users || tg_users.error!= null){
            break;
        }

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
                            disable_web_page_preview: true
                        }
                    }
                ]
            }
            messages.push({ payload, signedPayload: await signer.signMessage(JSON.stringify(payload))});
        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = jurorsAppealReminder.disputes[jurorsAppealReminder.disputes.length - 1].id;
        if (jurorsAppealReminder.disputes.length < 1000){
            botData.blockHeight = blockHeight;
            botData.indexLast = '0';
            break;
        };
    }
    return botData;
};


const formatMessage = (
    appeal: ArrayElement<JurorsAppealReminderV2Query["disputes"]>,
): string => {
    const secRemaining = Math.floor(Number(appeal.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    return `[Dispute ${appeal.id}](https://v2.kleros.builders/#/cases/${appeal.id}/overview) (*V2*) concluded it's current round!
    
If you think the ruling is incorrect, you can request an [appeal](https://v2.kleros.builders/#/cases/${appeal.id}/overview).

There is ${secRemaining > 60 ? `${timeRemaining}left to appeal.`: `less than a minute remains to appeal.`}`
};
