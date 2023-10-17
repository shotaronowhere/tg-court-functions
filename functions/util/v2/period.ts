import { getPeriodsV2, supportedChainIdsV2 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsPeriodV2Query, Period as PeriodV2 } from "../../../generated/kleros-v2-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const periodV2 = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    period: string,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const reminderDeadline = Math.floor(Date.now() / 1000) + 86400;
        const jurorsPeriod = await getPeriodsV2(
            botData.network as Supported<typeof supportedChainIdsV2>,
            {
                period: period as PeriodV2,
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        if (!jurorsPeriod || !jurorsPeriod.draws){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsPeriod.draws.length == 0) {
            break;
        }

        const jurors: string[] = jurorsPeriod.draws.map((draw) => getAddress(draw.juror.id));
        const jurorsMessages = jurorsPeriod.draws.map((draw) => {
            return { ...draw, message: formatMessage(period, draw) };
          });
          
        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        
        if (!tg_users || tg_users.error!= null ){
            break;
        }

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user) => tg_user.juror_address == getAddress(juror.juror.id));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user) => tg_user.juror_address == getAddress(juror.juror.id));
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
                    file: period,
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
        botData.indexLast = (jurorsPeriod.draws[jurorsPeriod.draws.length - 1].dispute.periodNotificationIndex + 1).toString();
        if (jurorsPeriod.draws.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    period: string,
    draw: ArrayElement<JurorsPeriodV2Query["draws"]>
) => {
    const secRemaining = Math.floor(Number(draw.dispute.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    const shortAddress = draw.juror.id.slice(0, 5) + "..." + draw.juror.id.slice(-3);
    const action = period == 'commit'? 'commit': 'cast'
    return `*** Time to ${action} your vote!*** 
    
The ${period} phase has started in [case ${
        draw.dispute.id
    }](https://court.kleros.io/cases/${draw.dispute.id}) (*V2*) for juror *${shortAddress}*.
${draw.dispute.court.hiddenVotes? '\n\nThis dispute is commit-reveal. Remember to reveal your vote later.\n\n' : ''}
You have ${timeRemaining}to ${action} your vote.`;
};