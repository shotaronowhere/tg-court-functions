import {
  Draw as DrawEvent,
  NewPeriod as NewPeriodEvent,
  DisputeCreation as DisputeCreationEvent,
  AppealDecision as AppealDecisionEvent,
  StakeSet as StakeSetEvent,
  ChangeSubcourtTimesPerPeriodCall,
  CreateSubcourtCall,
  KlerosLiquid
} from "../generated/KlerosLiquid/KlerosLiquid"
import {
  Court,
  Draw,
  Dispute,
  AppealDecision,
  Arbitrable,
  CourtCounter,
  UnstakingInactivity
} from "../generated/schema"
import {
  log,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";
import { Arbitrable as ArbitrableContract } from "../generated/templates";

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
    counter.numCourts = BigInt.fromI32(0);
  }
  let court = Court.load(counter.numCourts.toString());

  if (!court) {
    court = new Court(counter.numCourts.toString());
  }

  court.hiddenVotes = call.inputs._hiddenVotes;
  court.timesPerPeriod = call.inputs._timesPerPeriod;

  counter.numCourts = counter.numCourts.plus(BigInt.fromI32(1));
  counter.save();
  court.save();
}

export function handleStakeSet(event: StakeSetEvent): void {
  // proxy for unstaking due to inactivity eg msg.sender != _address
  // event.transaction.from is tx.origin
  // false positive for jurors with smart contract wallets
  if (event.transaction.from.notEqual(event.params._address)){
    let inactivity = UnstakingInactivity.load(event.transaction.hash.toHexString()+"-"+event.params._address.toHexString());
    if (!inactivity){
      inactivity = new UnstakingInactivity(event.transaction.hash.toHexString()+"-"+event.params._address.toHexString());
    }
    inactivity.blockNumber = event.block.number;
    inactivity.juror = event.params._address;
    inactivity.save();
  }
}

export function handleDraw(event: DrawEvent): void {
  let draw = Draw.load(
    event.params._disputeID.toString().concat("-").concat(event.params._appeal.toString()).concat("-").concat(event.params._address.toHexString())
  )
  
  if (draw) {
    // don't need to send duplicate notifications
    log.info("Draw entity already exists for dispute {} and round {}", [event.params._disputeID.toString(), event.params._appeal.toString()]);
    return;
  }
  draw = new Draw(
    event.params._disputeID.toString().concat("-").concat(event.params._appeal.toString()).concat("-").concat(event.params._address.toHexString())
  )
  draw.address = event.params._address
  draw.disputeID = event.params._disputeID.toString()
  draw.round = event.params._appeal
  draw.blockNumber = event.block.number

  draw.save()
}

export function handleDisputeCreation(event: DisputeCreationEvent): void {
  let dispute = new Dispute(
    event.params._disputeID.toString()
  )
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
  if (dispute.period == 'appeal') {
    dispute.currentRuling = getCurrentRulling(event.params._disputeID, event.address)
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