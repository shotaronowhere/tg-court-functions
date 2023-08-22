import axios from "axios";
import { datalake } from "../config/supabase";
import { StatusCodes } from "http-status-codes";
import { Handler, schedule } from "@netlify/functions";

const handler: Handler = async () => {
    try{
        const reponse = await datalake
        .from(`bot-block-heights`)
        .select("timestamp")
        .eq("bot_name", `tg-court-functions-appeal-possible`)
        .eq("network", "ethereum")

        if (reponse.error)
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                body: JSON.stringify({ error: reponse.error.message }),
            };
        

        const timestampOld = reponse.data[0].timestamp

        let startTimeMax = timestampOld;

        const appealQuery = {
            query: `{
                    disputes(first: 5, where: {period: appeal, lastPeriodChange_gt: ${startTimeMax}}, orderBy: lastPeriodChange) {
                        lastPeriodChange
                        disputeID
                        currentRulling
                    arbitrable {
                        id
                    }
                    }
                 }`,
        }

      
        const appeals = (await axios.post(`https://api.thegraph.com/subgraphs/name/klerosboard/klerosboard-mainnet`,    
            appealQuery))?.data?.data?.disputes ?? []
      
        for(const appeal of appeals){
            if (appeal.lastPeriodChange > startTimeMax){
                startTimeMax = appeal.lastPeriodChange
            }    

            const metaEvidenceQuery = {
              query: `{
              disputes(where: {id: ${appeal.disputeID}}) {
                metaEvidenceId
                createdAtBlock
                arbitrableHistory {
                  metaEvidence
                }
              }
            }`
            }

            const response = (await axios.post('https://api.thegraph.com/subgraphs/name/andreimvp/kleros-display-mainnet',    
            metaEvidenceQuery))?.data?.data?.disputes[0]
            let metaEvidenceId = response?.metaEvidenceId
            let createdAtBlock = response?.createdAtBlock
            let metaEvidenceUri = response?.arbitrableHistory?.metaEvidence
            if (!metaEvidenceUri){
              const { data, error } = await datalake
              .from("court-v1-metaevidence")
              .select("uri")
              .eq("chainId", 100)
              .eq("arbitrable", appeal.arbitrable.id)
              .eq("metaEvidenceId", metaEvidenceId);

              if (error)
                return {
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  body: JSON.stringify({ error: error.message }),
                };
      
              if (data && data.length) {
                metaEvidenceUri = data[0].uri;
              } else {
                const response = await fetch(
                  process.env.URL +
                    "/.netlify/functions/notice-metaevidence-background" +
                    `?chainId=100` +
                    `&metaEvidenceId=${metaEvidenceId}` +
                    `&arbitrable=${appeal.arbitrable.id}` +
                    `&endBlock=${createdAtBlock}`,
                  { method: "POST" }
                );
                  console.log(response)
                }
            }

            console.log(metaEvidenceUri)
            let res;
            try{ res = await axios.get(`https://ipfs.kleros.io/${metaEvidenceUri}`)}catch(e){};
            const title = res?.data?.title
            const description = res?.data?.description
            const isReality = 'A reality.eth question' == title
            const isModerate = (res?.data.fileURI as string).includes("Content%20Moderation")
            const refuseToArbitrate = appeal.currentRulling == 0
            let answerString = ""
            if (refuseToArbitrate){
                answerString = "Refuse to arbitrate"
            } else if (res?.data?.rulingOptions){
              const answerDes = res?.data?.rulingOptions?.descriptions[Number(appeal.currentRulling-1)]
              const answerTitle = res?.data?.rulingOptions?.titles[Number(appeal.currentRulling-1)]
              answerString = `${answerTitle}, ${answerDes}`
            } else if (isModerate) {
              answerString = appeal.currentRulling == 1? `Yes, the user broke the rules` : `No, the user didn't break the rules`
            } else {
              answerString = `Kleros ruling ${appeal.currentRulling}`
            }
            let questionString = isModerate? "Did the user break the rules? (Content Moderation)" : res?.data?.question
            console.log(res?.data)
            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.NOTIFICATION_CHANNEL,
                text: `[Dispute ${appeal.disputeID}](https://court.kleros.io/cases/${appeal.disputeID}) on Mainnet concluded it's current round!
                
    *${description}*

    Question: ${questionString}

    Answer: ${answerString}
  
Appeals can be [requested]${isReality? `(https://resolve.kleros.io/cases/${appeal.disputeID})` : `(https://court.kleros.io/cases/${appeal.disputeID})`}. View votes on [KlerosBoard](https://klerosboard.com/1/cases/${appeal.disputeID})`,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
                });
    
        }

        await datalake.from(`bot-block-heights`).update({timestamp: startTimeMax}).eq("bot_name", `tg-court-functions-appeal-possible`).eq("network", "ethereum")
        
        return {
            statusCode: StatusCodes.OK
        };
    } catch (err: any) {
        console.log(err)
        return {
          statusCode: StatusCodes.BAD_REQUEST,
          body: JSON.stringify({ error: err.message }),
        };
      }

};

module.exports.handler = schedule("@hourly", handler);