import { getDraws, supportedChainIdsV1 } from "../../../config/subgraph";
import { getAddress } from "ethers";
import { JurorsDrawnQuery } from "../../../generated/kleros-v1-notifications";
import { notificationSystem } from "../../../config/supabase";
import { ArrayElement, BotData, Supported } from "../../../types";
import { Channel } from 'amqplib';
import { Logtail } from "@logtail/node";
import { sendToRabbitMQ } from "../rabbitMQ";
import { Wallet } from "ethers";

export const draw = async (
    channel: Channel,
    logtail: Logtail,
    signer: Wallet,
    blockHeight: number,
    botData: BotData,
    testTgUserId?: number
): Promise<BotData> => {
    while (1){
        const jurorsDrawn = await getDraws(
            botData.network as Supported<typeof supportedChainIdsV1>,
            {
                blockHeight,
                indexLast: botData.indexLast
            }
        )

        if (!jurorsDrawn || !jurorsDrawn.userRoundInfos){
            logtail.error("invalid query or subgraph error. BotData: ", {botData});
            break;
        }

        if (jurorsDrawn.userRoundInfos.length == 0) {
            break;
        }

        const jurors: string[] = jurorsDrawn.userRoundInfos.map((juror) => getAddress(juror.juror));
        const jurorsMessages = jurorsDrawn.userRoundInfos.map((juror) => {
            return { ...juror, message: formatMessage(juror, botData.network) };
          });
          

        const tg_users = await notificationSystem.rpc("get_subscribers", {vals: jurors})

        if (!tg_users || tg_users.error!= null){
            break;
        }

        let messages = [];
        for (const juror of jurorsMessages) {
            let tg_subcribers : number[] = [];
            if (testTgUserId != null){
                tg_subcribers.push(testTgUserId);
            } else {
                tg_users.data.find((tg_user) => tg_user.juror_address == getAddress(juror.juror));
                // get_subscribers returns sorted by juror_address
                let index = tg_users.data.findIndex((tg_user) => tg_user.juror_address == getAddress(juror.juror));
                if (index == -1) continue; 
                while (tg_users.data[index]?.juror_address == getAddress(juror.juror)){
                    tg_subcribers.push(tg_users.data[index]?.tg_user_id);
                    index++;
                }
            }
            // Telegram API malfunctioning, can't send caption with animation
            // sending two messages instead
            const payload = 
            { 
                tg_subcribers, 
                messages: [
                    {
                    cmd: "sendAnimation",
                    file: "drawn",
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
        botData.indexLast = (Number(jurorsDrawn.userRoundInfos[jurorsDrawn.userRoundInfos.length - 1].drawNotificationIndex) + 1).toString();
        if (jurorsDrawn.userRoundInfos.length < 1000) break;
    }
    return botData;
};

const formatMessage = (
    juror: ArrayElement<JurorsDrawnQuery["userRoundInfos"]>,
    chainid: number
) => {
    const isCommitReveal = juror.dispute.court.hiddenVotes;
    const secRemaining = Math.floor(Number(juror.dispute.periodDeadline) - Date.now()/1000)

    const daysRemaining = Math.floor(secRemaining / 86400)
    const hoursRemaining = Math.floor((secRemaining % 86400) / 3600)
    const minRemaining = Math.floor((secRemaining % 3600) / 60)
    const timeRemaining = `${daysRemaining > 0 ? `${daysRemaining} day${daysRemaining > 1 ? "s " : " "}` : ""}` +
                            `${hoursRemaining > 0 ? `${hoursRemaining} hour${hoursRemaining > 1 ? "s " : " "}` : ""}` +
                            `${minRemaining > 0 && hoursRemaining == 0 && daysRemaining == 0? `${minRemaining} min${minRemaining > 1 ? "s " : " "}` : ""}`
    const shortAddress = juror.juror.slice(0, 5) + "..." + juror.juror.slice(-3);
    return `***Juror duty awaits you!*** 
    
*${shortAddress}* has been drawn in [case ${
        juror.dispute.id
    }](https://court.kleros.io/cases/${juror.dispute.id}) ${
        chainid == 1 ? "(*V1*)" : "(*V1 Gnosis*)"
    }.
    
${isCommitReveal? "This dispute is commit-reveal. Remember to reveal your vote later.\n\n": ""} Voting starts in ${secRemaining > 60 ? timeRemaining.substring(0,timeRemaining.length-1) : 'less than a minute'}. You can already start reviewing the evidence.`;
};