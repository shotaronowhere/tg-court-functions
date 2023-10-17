import { GraphQLClient } from "graphql-request";
import { arbitrum, arbitrumGoerli, gnosis, mainnet } from "viem/chains";
import {
    NewDisputesQuery,
    JurorsDrawnQuery,
    Sdk,
    getSdk,
    JurorsPeriodQuery,
    JurorsPeriodReminderQuery,
    JurorsAppealQuery,
    JurorsAppealReminderQuery,
    Period
} from "../generated/kleros-v1-notifications";
import {
    NewDisputesV2Query,
    JurorsDrawnV2Query,
    Sdk as SdkV2,
    getSdk as getSdkV2,
    JurorsPeriodV2Query,
    JurorsPeriodReminderV2Query,
    JurorsAppealV2Query,
    JurorsAppealReminderV2Query,
    JurorsAppealFundedV2Query,
    JurorsAppealFundedReminderV2Query,
    Period as PeriodV2,
} from "../generated/kleros-v2-notifications";
import { Supported } from "../types";

const subgraphUrlV1 = {
    [mainnet.id]:
        "https://api.thegraph.com/subgraphs/name/shotaronowhere/kleros-display-mainnet",
    [gnosis.id]:
        "https://api.thegraph.com/subgraphs/name/shotaronowhere/kleros-display-gnosis",
} as const;

const subgraphUrlV2 = {
    [arbitrumGoerli.id]:
        "https://api.thegraph.com/subgraphs/name/shotaronowhere/kleros-v2-core-devnet",
} as const;

export const sdksV1 = Object.entries(subgraphUrlV1).reduce(
    (acc, [chainId, url]) => {
        return ({
        ...acc,
        [+chainId]: getSdk(new GraphQLClient(url)),
        })
},
    {} as Record<Supported<(keyof typeof subgraphUrlV1)[]>, Sdk>
);

export const sdksV2 = Object.entries(subgraphUrlV2).reduce(
    (acc, [chainId, url]) => {
        return ({
        ...acc,
        [+chainId]: getSdkV2(new GraphQLClient(url)),
        })
},
    {} as Record<Supported<(keyof typeof subgraphUrlV2)[]>, SdkV2>
);

export const supportedChainIdsV1 = [
    mainnet.id,
    gnosis.id,
];

export const supportedChainIdsV2 = [
    arbitrumGoerli.id,
];

require('dotenv').config()
const { RPC_URL_GNOSIS, RPC_URL_MAINNET, RPC_URL_ARB_GOERLI } = process.env

export const rpcUrl = {
    [mainnet.id]: RPC_URL_MAINNET,
    [gnosis.id]: RPC_URL_GNOSIS,
    [arbitrumGoerli.id]: RPC_URL_ARB_GOERLI,
};

export const getAppealableDisputes = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let appealableDisputes: JurorsAppealQuery | undefined = undefined;
    try {
        appealableDisputes = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["JurorsAppeal"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return appealableDisputes;
}

export const getAppealableDisputesV2 = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let appealableDisputes: JurorsAppealV2Query | undefined = undefined;
    try {
        appealableDisputes = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["JurorsAppealV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return appealableDisputes;
}

export const getNewDisputes = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { blockHeight: number, disputeID: number;}
) => {
    let res: NewDisputesQuery | undefined = undefined;
    try {
        res = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["NewDisputes"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getNewDisputesV2 = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { blockHeight: number, disputeID: number;}
) => {
    let res: NewDisputesV2Query | undefined = undefined;
    try {
        res = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["NewDisputesV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getDraws = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { blockHeight: number; indexLast: any; }
) => {
    let res: JurorsDrawnQuery | undefined = undefined;
    try {
        res = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["JurorsDrawn"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}


export const getDrawsV2 = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { blockHeight: number; indexLast: any; }
) => {
    let res: JurorsDrawnV2Query | undefined = undefined;
    try {
        res = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["JurorsDrawnV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getPeriods = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { period: Period, reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let res: JurorsPeriodQuery | undefined = undefined;
    try {
        res = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["JurorsPeriod"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getPeriodReminders = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { period: Period, reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsPeriodReminderQuery | undefined = undefined;
    try {
        res = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["JurorsPeriodReminder"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getPeriodsV2 = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { period: PeriodV2, reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let res: JurorsPeriodV2Query | undefined = undefined;
    try {
        res = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["JurorsPeriodV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getPeriodV2Reminders = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { period: PeriodV2, reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsPeriodReminderV2Query | undefined = undefined;
    try {
        res = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["JurorsPeriodReminderV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getAppealReminders = async (
    chainId: Supported<typeof supportedChainIdsV1>,
    params: { reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsAppealReminderQuery | undefined = undefined;
    try {
        res = await sdksV1[chainId as Supported<(keyof typeof subgraphUrlV1)[]>]["JurorsAppealReminder"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getAppealRemindersV2 = async (
    chainId: Supported<typeof supportedChainIdsV2>,
    params: { reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsAppealReminderV2Query | undefined = undefined;
    try {
        res = await sdksV2[chainId as Supported<(keyof typeof subgraphUrlV2)[]>]["JurorsAppealReminderV2"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}
