import {
    MetaEvidence as MetaEvidenceEvent,
    Dispute as DisputeEvent
  } from "../generated/templates/Arbitrable/Arbitrable"
import {
    ArbitrableHistory,
    MetaEvidence,
    Dispute,
    RulingOptions
  } from "../generated/schema"
import {
    Bytes,
    log,
    ipfs,
    json
  } from "@graphprotocol/graph-ts";

export function handleMetaEvidence(event: MetaEvidenceEvent): void {
  const arbitrableHistory = new ArbitrableHistory(event.address.toHexString()+event.params._metaEvidenceID.toString())
  const metaEvidence = new MetaEvidence(event.params._evidence)

  arbitrableHistory.metaEvidence = event.params._evidence;
  arbitrableHistory.arbitrable = event.address;

  let jsonStr = ipfs.cat(event.params._evidence);
  if (!jsonStr) {
    log.error('Failed to fetch metaevidence {} for arbitrable {}', [event.params._evidence, event.address.toHexString()]);
    arbitrableHistory.save();
    metaEvidence.save();
    return;
  }

  let jsonObjValueAndSuccess = json.try_fromBytes(jsonStr as Bytes);
  if (!jsonObjValueAndSuccess.isOk) {
    log.error('Failed to get json object metaevidence {} for arbitrable {}', [event.params._evidence, event.address.toHexString()]);
    arbitrableHistory.save();
    metaEvidence.save();
    return;
  }

  let jsonObj = jsonObjValueAndSuccess.value.toObject();
  if (!jsonObj) {
    log.error('Failed converting object metaevidence {} for arbitrable {}', [event.params._evidence, event.address.toHexString()]);
    arbitrableHistory.save();
    metaEvidence.save();
    return;
  }

  const title = jsonObj.get('title');
  metaEvidence.category = title? title.toString() : null;

  const description = jsonObj.get('description');
  metaEvidence.description = description? description.toString() : null;

  const question = jsonObj.get('question');
  metaEvidence.question = question? question.toString() : null;

  const fileURI = jsonObj.get('fileURI');
  metaEvidence.category = fileURI? fileURI.toString() : null;

  const category = jsonObj.get('category');
  metaEvidence.category = category? category.toString() : null;

  const rulingOptions = jsonObj.get('rulingOptions');

  if (rulingOptions) {
    const rulingOptionsEntity = new RulingOptions(event.address.toHexString()+event.params._metaEvidenceID.toString());
    rulingOptionsEntity.metaEvidence = metaEvidence.id;
    rulingOptionsEntity.descriptions = [];
    rulingOptionsEntity.titles = [];
    let rulingOptionTitles = rulingOptions.toObject().get('titles')
    let rulingOptionDesc = rulingOptions.toObject().get('descriptions');
    if (rulingOptionTitles) {
      rulingOptionsEntity.titles  = rulingOptionTitles.toArray().map<string>((title) => title.toString())
    }
    if (rulingOptionDesc) {
      rulingOptionsEntity.descriptions  = rulingOptionDesc.toArray().map<string>((title) => title.toString())
    }
    rulingOptionsEntity.save();
  }

  arbitrableHistory.save();
  metaEvidence.save();

}


export function handleDispute(event: DisputeEvent): void {  
  const dispute = Dispute.load(event.params._disputeID.toString());
  if (dispute == null) {
      log.error("Dispute {} not found", [event.params._disputeID.toString()]);    
      return
  };
  dispute.metaEvidenceId = event.params._metaEvidenceID;
  dispute.arbitrableHistory = event.address.toHexString()+event.params._metaEvidenceID.toString();

  dispute.save();
}