import {
  Draw as DrawEvent,
  NewPeriod as NewPeriodEvent,
  DisputeCreation as DisputeCreationEvent,
  AppealDecision as AppealDecisionEvent,
  KlerosLiquid
} from "../generated/KlerosLiquid/KlerosLiquid"
import {
  Draw,
  Dispute,
  AppealDecision,
  Arbitrable
} from "../generated/schema"
import {
  log,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";
import { Arbitrable as ArbitrableContract } from "../generated/templates";

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
  const subcourtData = contract.getSubcourt(BigInt.fromString(dispute.subcourt))
  const timesPerPeriod = subcourtData.getTimesPerPeriod()
  log.info("Subcourt id {}, times per period", [dispute.subcourt, timesPerPeriod.toString()])

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