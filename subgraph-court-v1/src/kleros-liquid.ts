import {
  Draw as DrawEvent,
  NewPeriod as NewPeriodEvent,
  DisputeCreation as DisputeCreationEvent,
  AppealDecision as AppealDecisionEvent,
  ChangeSubcourtTimesPerPeriodCall,
  CreateSubcourtCall,
  CastCommitCall,
  CastVoteCall,
  KlerosLiquid
} from "../generated/KlerosLiquid/KlerosLiquid"
import {
  Court,
  Draw,
  Dispute,
  AppealDecision,
  Arbitrable,
  CourtCounter,
  AppealNotification,
  Round
} from "../generated/schema"
import {
  log,
  Address,
  BigInt,
} from "@graphprotocol/graph-ts";
import { Arbitrable as ArbitrableContract } from "../generated/templates";

export function CastCommitCallHandler(call: CastCommitCall): void {
  const dispute = Dispute.load(call.inputs._disputeID.toString());

  if (!dispute) {
    log.error("Dispute {} does not exist", [call.inputs._disputeID.toString()]);
    return;
  }
  const round = Round.load(dispute.round);

  if (!round) {
    log.error("Round {} does not exist", [dispute.round]);
    return;
  }


  if (!call.inputs._voteIDs.length || call.inputs._voteIDs.length == 0){
    log.error("CastCommitCallHandler: voteIDs length is zero or null", []);
    return;
  }
  let contract = KlerosLiquid.bind(changetype<Address>(Address.fromHexString("0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002")))
  const vote = contract.getVote(call.inputs._disputeID, round.round, call.inputs._voteIDs[0])

  let draw = Draw.load(
    call.inputs._disputeID.toString().concat("-").concat(vote.getAccount().toHexString())
  )
  if (draw) {
    draw.commited = true;
    draw.save();
  } else {
    log.error("Draw entity does not exist for dispute {} and round {}", [call.inputs._disputeID.toString(), round.round.toString()]);
    return;
  }
}

export function CastVoteCallHandler(call: CastVoteCall): void {
  const dispute = Dispute.load(call.inputs._disputeID.toString());

  if (!dispute) {
    log.error("Dispute {} does not exist", [call.inputs._disputeID.toString()]);
    return;
  }
  const round = Round.load(dispute.round);

  if (!round) {
    log.error("Round {} does not exist", [dispute.round]);
    return;
  }


  if (!call.inputs._voteIDs.length || call.inputs._voteIDs.length == 0){
    log.error("CastCommitCallHandler: voteIDs length is zero or null", []);
    return;
  }
  let contract = KlerosLiquid.bind(changetype<Address>(Address.fromHexString("0x9c1da9a04925bdfdedf0f6421bc7eea8305f9002")))
  const vote = contract.getVote(call.inputs._disputeID, round.round, call.inputs._voteIDs[0])

  let draw = Draw.load(
    call.inputs._disputeID.toString().concat("-").concat(vote.getAccount().toHexString())
  )
  if (draw) {
    draw.voted = call.inputs._choice;
    draw.save();
  } else {
    log.error("Draw entity does not exist for dispute {} and round {}", [call.inputs._disputeID.toString(), round.round.toString()]);
    return;
  }
}


export function ChangeSubcourtTimesPerPeriodCallHandler(call: ChangeSubcourtTimesPerPeriodCall): void {
  const subcourt = call.inputs._subcourtID.toString();
  let court = Court.load(subcourt)

  if (!court) {
    log.error("Court {} does not exist", [subcourt]);
    return;
  }

  court.timesPerPeriod = call.inputs._timesPerPeriod;
  court.save();
}

export function CreateSubcourtCallHandler(call: CreateSubcourtCall): void {
  let counter = CourtCounter.load("CourtCounter");
  if (!counter) {
    counter = new CourtCounter("CourtCounter");
    counter.counter = BigInt.fromI32(0);
  }
  let court = Court.load(counter.counter.toString());

  if (!court) {
    court = new Court(counter.counter.toString());
  }

  court.hiddenVotes = call.inputs._hiddenVotes;
  court.timesPerPeriod = call.inputs._timesPerPeriod;

  counter.counter = counter.counter.plus(BigInt.fromI32(1));
  counter.save();
  court.save();
}


export function handleDraw(event: DrawEvent): void {

  let dispute = Dispute.load(event.params._disputeID.toString());


  let counter = CourtCounter.load("DrawCounter");
  if (!counter) {
    counter = new CourtCounter("DrawCounter");
    counter.counter = BigInt.fromI32(0);
  }
  const id = event.params._disputeID.toString().concat("-").concat(event.params._address.toHexString());
  let draw = Draw.load(id)
  if (!draw){
    draw = new Draw(id)
  }
  draw.address = event.params._address
  draw.voteID = event.params._voteID
  draw.disputeID = event.params._disputeID.toString()
  draw.commited = false
  draw.voted = null
  draw.round = event.params._disputeID.toHexString()+event.params._appeal.toHexString()
  draw.blockNumber = event.block.number
  draw.index = counter.counter
  counter.counter = counter.counter.plus(BigInt.fromI32(1));
  counter.save();
  draw.save()
}

export function handleDisputeCreation(event: DisputeCreationEvent): void {
  let dispute = new Dispute(
    event.params._disputeID.toString()
  )
  let round = new Round(event.params._disputeID.toHexString()+BigInt.fromU32(0).toHexString())
  round.active = true;
  round.round = BigInt.fromU32(0)
  round.save();
  let arbitrable = Arbitrable.load(event.params._arbitrable);
  if (arbitrable == null) {
    ArbitrableContract.create(event.params._arbitrable);
    
    arbitrable = new Arbitrable(event.params._arbitrable);
    arbitrable.save();
  }
  dispute.period = 'evidence'
  dispute.lastPeriodChangeBlock = event.block.number
  dispute.lastPeriodChangeTimestamp = event.block.timestamp
  dispute.disputeID = event.params._disputeID
  dispute.arbitrable = event.params._arbitrable
  dispute.round = event.params._disputeID.toHexString()+BigInt.fromU32(0).toHexString()
  let contract = KlerosLiquid.bind(event.address)
  let disputeData = contract.disputes(event.params._disputeID)
  dispute.subcourt = disputeData.value0.toString()
  const subcourtGetterData = contract.getSubcourt(BigInt.fromString(dispute.subcourt))

  let court = Court.load(
    disputeData.value0.toString()
  )

  // first dispute create the general court (created in constructor without an event)
  if (event.params._disputeID == BigInt.fromI32(0)) {
    court = new Court("0")
    const subcourtData = contract.courts(BigInt.fromI32(0))
    court.hiddenVotes = subcourtData.getHiddenVotes()
    court.timesPerPeriod = subcourtGetterData.getTimesPerPeriod()
    court.save()
  }

  const timesPerPeriod = subcourtGetterData.getTimesPerPeriod()
  log.info("Subcourt id {}, times per period", [dispute.subcourt, timesPerPeriod.toString()])
  contract.courts(BigInt.fromString(dispute.subcourt))
  dispute.periodDeadline = timesPerPeriod[0].plus(event.block.timestamp)
  dispute.currentRuling = BigInt.fromI32(0)
  dispute.save()
}

export function handleNewPeriod(event: NewPeriodEvent): void {
  let dispute = Dispute.load(
    event.params._disputeID.toString()
  )

  if (!dispute) {
    log.info("Dispute entity does not exist for dispute {}", [event.params._disputeID.toString()]);
    return;
  }

  dispute.period = getPeriodString(event.params._period)

  if (dispute.period == 'commit') {
    let counter = CourtCounter.load("CommitCounter");
    if (!counter) {
      counter = new CourtCounter("CommitCounter");
      counter.counter = BigInt.fromI32(0);
    }
    dispute.periodCommitIndex = counter.counter;
    counter.counter.plus(BigInt.fromI32(1))
    counter.save();
  } else if (dispute.period == 'vote'){
    let counter = CourtCounter.load("VoteCounter");
    if (!counter) {
      counter = new CourtCounter("VoteCounter");
      counter.counter = BigInt.fromI32(0);
    }
    dispute.periodVoteIndex = counter.counter;
    counter.counter.plus(BigInt.fromI32(1))
    counter.save();
  } else if (dispute.period == 'appeal') {
    dispute.currentRuling = getCurrentRulling(event.params._disputeID, event.address)
    let counter = CourtCounter.load("AppealCounter");
    if (!counter) {
      counter = new CourtCounter("AppealCounter");
      counter.counter = BigInt.fromI32(0);
    }
    dispute.periodAppealIndex = counter.counter;
    counter.counter.plus(BigInt.fromI32(1))
    counter.save();
  }

  if (dispute.period != 'execution') {
    const subcourtData = KlerosLiquid.bind(event.address).getSubcourt(BigInt.fromString(dispute.subcourt))
    const timedPerPeriod = subcourtData.getTimesPerPeriod()
    dispute.periodDeadline = timedPerPeriod[event.params._period].plus(event.block.timestamp)
    dispute.lastPeriodChangeBlock = event.block.timestamp
    dispute.lastPeriodChangeTimestamp = event.block.timestamp
  }

  dispute.save()
}

export function handleAppealDecision(event: AppealDecisionEvent): void {
  let entity = new AppealDecision(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let dispute = Dispute.load(
    event.params._disputeID.toString()
  )

  if (!dispute) {
    log.info("Dispute entity does not exist for dispute {}", [event.params._disputeID.toString()]);
    return;
  }

  let roundOld = Round.load(dispute.round)
  if (!roundOld) {
    log.info("Round entity does not exist for dispute {}", [event.params._disputeID.toString()]);
    return;
  }
  roundOld.active = false;
  roundOld.save();
  let roundNumber = roundOld.round.plus(BigInt.fromI32(1))

  let round = new Round(event.params._disputeID.toHexString()+roundNumber.toHexString())
  dispute.round = round.id
  dispute.save();
  round.round = roundNumber;
  round.active = true;
  round.save();

  entity.disputeID = event.params._disputeID
  entity.arbitrable = event.params._arbitrable

  entity.blockNumber = event.block.number
  entity.save()
}


// Helper functions
function getPeriodString(period: number): string {
  log.debug("getPeriod function: Asking period of number {}", [period.toString()])
  if (period == 0) {
    return 'evidence'
  }
  else if (period == 1) {
    return 'commit'
  }
  else if (period == 2) {
    return 'vote'
  }
  else if (period == 3) {
    return 'appeal'
  }
  else if (period == 4) {
    return 'execution'
  }
  return ''

}

function getCurrentRulling(disputeID: BigInt, address: Address): BigInt {
  log.debug("getCurrentRulling: Asking current rulling in dispute {}", [disputeID.toString()])
  let contract = KlerosLiquid.bind(address)
  let callResult = contract.try_currentRuling(disputeID)
  let currentRulling = BigInt.fromI32(0)
  if (callResult.reverted) {
    log.debug("getCurrentRulling: currentRulling reverted", [])
  } else {
    currentRulling = callResult.value
  }
  return currentRulling
}