import { getPeriods, supportedChainIdsV1 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsPeriodQuery, Period } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const period = async (
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
        const jurorsPeriod = await getPeriods(
            botData.network as Supported<typeof supportedChainIdsV1>,
            {
                period: period as Period,
                reminderDeadline,
                blockHeight,
                indexLast: botData.indexLast,
            }
        )
        
        if (!jurorsPeriod || !jurorsPeriod){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsPeriod.userRoundInfos.length == 0) {
            break;
        }

        const jurors: string[] = jurorsPeriod.userRoundInfos.map((juror) => getAddress(juror.juror));
        const jurorsMessages = jurorsPeriod.userRoundInfos.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network, period) };
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
                tg_users.data.find((tg_user) => tg_user.juror_address == getAddress(juror.juror));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user) => tg_user.juror_address == getAddress(juror.juror));
                if (index > -1){
                    while (tg_users.data[index]?.juror_address == getAddress(juror.juror)){
                        tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                        index++;
                    }
                }
            }
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = { 
                tg_subcribers, 
                messages: [
                    {
                    cmd: "sendAnimation",
                    file: "commit",
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
        botData.indexLast = (Number(jurorsPeriod.userRoundInfos[jurorsPeriod.userRoundInfos.length - 1].dispute.periodNotificationIndex) + 1).toString();
        if (jurorsPeriod.userRoundInfos.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsPeriodQuery["userRoundInfos"]>,
    chainid: number,
    period: string
) => {
    const secRemaining = Math.floor(Number(juror.dispute.periodDeadline) - Date.now()/1000)
    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day ` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour ` : ""}` +
                            `${minRemaining > 0 && daysRemaining == 0 ? `${minRemaining} min ` : ""}`
    const shortAddress = juror.juror.slice(0, 5) + "..." + juror.juror.slice(-3);
    const action = period == "COMMIT" ? "commit" : "cast";
    return `*** Time to ${action} your vote!*** 
    
The ${period.toLowerCase()} phase has started in [case ${
        juror.dispute.id
    }](https://court.kleros.io/cases/${juror.dispute.id}) ${
        chainid == 1 ? "(*V1*)" : "(*V1 Gnosis*) "
    }for juror *${shortAddress}*.    
${juror.dispute.court.hiddenVotes? "\nThis dispute is commit-reveal. Remember to reveal your vote later.\n" : ""}
You have ${timeRemaining}to ${action} your vote.`;
};