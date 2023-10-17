import { getPeriodReminders, supportedChainIdsV1 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsPeriodReminderQuery, Period } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const periodReminder = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    period: string,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const timeNow = Math.floor(Date.now() / 1000);
        const reminderDeadline = timeNow + 86400; // 24 hours
        const jurorsCommit = await getPeriodReminders(
            botData.network as Supported<typeof supportedChainIdsV1>,
            {
                timeNow,
                reminderDeadline,
                blockHeight,
                idLast: botData.indexLast,
                blockLast: botData.blockHeight,
                period: period as Period,
            }
        )
        
        if (!jurorsCommit || !jurorsCommit.userRoundInfos){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsCommit.userRoundInfos.length == 0) {
            botData.indexLast = "0";
            botData.blockHeight = blockHeight;
            break;
        }

        const jurors: string[] = jurorsCommit.userRoundInfos.map((juror) => getAddress(juror.juror));
        const jurorsMessages = jurorsCommit.userRoundInfos.map((juror) => {
            return { ...juror, message: formatMessage(period, juror, botData.network) };
          });
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null) {
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror));
                if (index == -1) continue; 
                while (tg_users.data[index]?.juror_address == getAddress(juror.juror)){
                    tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                    index++;
                }
            }
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = { 
                    tg_subcribers, 
                    messages: [
                        {
                        cmd: "sendAnimation",
                        file: "reminder",
                        },{
                        cmd: "sendMessage",
                        msg: juror.message,
                        options: 
                            {
                                parse_mode: "Markdown",
                            }
                        }
                    ]
                }
            messages.push({ payload, signedPayload: signer.signMessage(JSON.stringify(payload))});
        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = jurorsCommit.userRoundInfos[jurorsCommit.userRoundInfos.length - 1].id;
        if (jurorsCommit.userRoundInfos.length < 1000){
            botData.blockHeight = blockHeight;
            botData.indexLast = "0";
            break;
        };
    }
    return botData;
};

const formatMessage = (
    period: string,
    juror: ArrayElement<JurorsPeriodReminderQuery["userRoundInfos"]>,
    chainid: number
) => {
    const secRemaining = Math.floor(Number(juror.dispute.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    
    const shortAddress = juror.juror.slice(0, 5) + "..." + juror.juror.slice(-3);
    const action = period == 'commit'? 'commit': 'cast'
    return `*** Reminder to ${action} your vote!*** 
    
The ${period} phase has started in [case ${
        juror.juror
    }](https://court.kleros.io/cases/${juror.dispute.id}) ${
        chainid == 1 ? "(*V1*)" : "(*V2 Gnosis*) "
    }for juror *${shortAddress}*.
${juror.dispute.court.hiddenVotes? '\n\nThis dispute is commit-reveal. Remember to reveal your vote later.\n\n' : ''}
You have ${timeRemaining}to ${action} your vote.`;
};