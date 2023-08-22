import axios from "axios";
import { datalake, notificationSystem } from "../../config/supabase";
import { StatusCodes } from "http-status-codes";

export const cronAppeal = async (network: string) => {
    try{
        if (network != "gnosis"){
            network = "ethereum"
        }
        const chainid = network == "ethereum" ? 1 : 100

        const reponse = await notificationSystem
        .from(`bot-block-heights`)
        .select("timestamp")
        .eq("bot_name", `tg-court-appeal`)
        .eq("network", network)

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

      
        const appeals = (await axios.post(`https://api.thegraph.com/subgraphs/name/klerosboard/klerosboard-${network == "ethereum" ? "mainnet" : network}`,    
            appealQuery))?.data?.data?.disputes ?? []
      
        for(const appeal of appeals){
            const metaEvidenceQuery = {
              query: `{
              disputes(where: {id: ${appeal.disputeID}}) {
                metaEvidenceId
                arbitrableHistory {
                  metaEvidence
                }
              }
            }`
            }

            const response = (await axios.post(`https://api.thegraph.com/subgraphs/name/andreimvp/kleros-display${network == "ethereum" ? "-mainnet"  : ""}`,    
            metaEvidenceQuery))?.data?.data?.disputes[0]
            let metaEvidenceId = response?.metaEvidenceId
            let metaEvidenceUri = response?.arbitrableHistory?.metaEvidence
            if (!metaEvidenceUri){
                const { data } = await datalake
                    .from("court-v1-metaevidence")
                    .select("uri")
                    .eq("chainId", chainid)
                    .eq("arbitrable", appeal.arbitrable.id)
                    .eq("metaEvidenceId", metaEvidenceId);
        
                if (data && data.length) {
                    metaEvidenceUri = data[0].uri;
                } 
            }
            let res;
            if (metaEvidenceUri){
                try{ res = await axios.get(`https://ipfs.kleros.io/${metaEvidenceUri}`)}catch(e){};
            }
            const title = res?.data?.title
            const description = res?.data?.description
            const isReality = 'A reality.eth question' == title
            const isModerate = (res?.data?.fileURI as string).includes("Content%20Moderation")
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

            await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.NOTIFICATION_CHANNEL,
                text: `[Dispute ${appeal.disputeID}](https://court.kleros.io/cases/${appeal.disputeID}) on ${network} concluded it's current round!
                
    *${description}*

    Question: ${questionString ? questionString : "See court for question"}

    Current Ruling: ${answerString? answerString : `${appeal.currentRulling} (see court for ruling meaning)`}
  
If you think the ruling is incorrect, you can request an [appeal]${isReality? `(https://resolve.kleros.io/cases/${appeal.disputeID})` : `(https://court.kleros.io/cases/${appeal.disputeID})`}.`,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
                });
            if (appeal.lastPeriodChange > startTimeMax){
                startTimeMax = appeal.lastPeriodChange
            }
        }

        await notificationSystem.from(`bot-block-heights`).update({timestamp: startTimeMax}).eq("bot_name", `tg-court-appeal`).eq("network", "gnosis")
        
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
}