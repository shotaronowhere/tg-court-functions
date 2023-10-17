import { getPeriodV2Reminders, supportedChainIdsV2 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsPeriodReminderV2Query, Period } from "../../../generated/kleros-v2-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const periodReminderV2 = async (
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
        const jurorsPeriod = await getPeriodV2Reminders(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                timeNow,
                reminderDeadline,
                blockHeight,
                idLast: botData.indexLast,
                blockLast: botData.blockHeight,
                period: period as Period,
            }
        )
        
        if (!jurorsPeriod || !jurorsPeriod.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsPeriod.draws.length == 0) {
            botData.indexLast = "0";
            botData.blockHeight = blockHeight;
            break;
        }

        const jurors: string[] = jurorsPeriod.draws.map((juror) => getAddress(juror.juror.id));
        const jurorsMessages = jurorsPeriod.draws.map((juror) => {
            return { ...juror, message: formatMessage(period, juror, botData.network) };
          });
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if(testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror.id));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user: { juror_address: string; }) => tg_user.juror_address == getAddress(juror.juror.id));
                if (index == -1) continue; 
                while (tg_users.data[index]?.juror_address == getAddress(juror.juror.id)){
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
            messages.push({ payload, signedPayload: await signer.signMessage(JSON.stringify(payload))});

        }
        await sendToRabbitMQ(logtail, channel, messages);
        botData.indexLast = jurorsPeriod.draws[jurorsPeriod.draws.length - 1].id;
        if (jurorsPeriod.draws.length < 1000){
            botData.blockHeight = blockHeight;
            botData.indexLast = '0';
            break;
        };
    }
    return botData;
};

const formatMessage = (
    period: string,
    juror: ArrayElement<JurorsPeriodReminderV2Query["draws"]>,
    chainid: number
) => {
    const secRemaining = Math.floor(Number(juror.dispute.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    
    const shortAddress = juror.juror.id.slice(0, 5) + "..." + juror.juror.id.slice(-3);
    const action = period == 'commit'? 'commit': 'cast'
    return `*** Reminder to ${action} your vote!*** 
    
It is time to ${action} your vote in [case ${
        juror.dispute.id
    }](https://court.kleros.io/cases/${juror.dispute.id}) (*V2*) for juror *${shortAddress}*.
${juror.dispute.court.hiddenVotes? '\n\nThis dispute is commit-reveal. Remember to reveal your vote later.\n\n' : ''}
You have ${secRemaining > 60? timeRemaining : 'You have less than a minute remaining'} to ${action} your vote.`
};