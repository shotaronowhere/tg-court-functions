import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet } from "viem/chains";
import {
    NewDisputesQuery,
    JurorsDrawnQuery,
    Sdk,
    getSdk,
    JurorsVoteQuery,
    JurorsVoteReminderQuery,
    JurorsCommitQuery,
    JurorsCommitReminderQuery,
    JurorsAppealQuery,
    JurorsAppealReminderQuery,
} from "../generated/kleros-v1-notifications";
import { Supported } from "../types";

const subgraphUrl = {
    [mainnet.id]:
        "https://api.thegraph.com/subgraphs/name/shotaronowhere/kleros-v1-notifications",
    [gnosis.id]:
        "https://api.thegraph.com/subgraphs/name/shotaronowhere/kleros-v1-notifications-gnosis",
} as const;

export const sdks = Object.entries(subgraphUrl).reduce(
    (acc, [chainId, url]) => ({
        ...acc,
        [+chainId]: getSdk(new GraphQLClient(url)),
    }),
    {} as Record<Supported<(keyof typeof subgraphUrl)[]>, Sdk>
);

export const supportedChainIds = [
    mainnet.id,
    gnosis.id
];

require('dotenv').config()
const { RPC_URL_GNOSIS, RPC_URL_MAINNET } = process.env

export const rpcUrl = {
    [mainnet.id]: RPC_URL_MAINNET,
    [gnosis.id]: RPC_URL_GNOSIS,
};

export const getAppealableDisputes = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let appealableDisputes: JurorsAppealQuery | undefined = undefined;
    try {
        appealableDisputes = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsAppeal"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return appealableDisputes;
}

export const getNewDisputes = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { blockHeight: number, disputeID: number;}
) => {
    let res: NewDisputesQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["NewDisputes"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getDraws = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { blockHeight: number; indexLast: any; }
) => {
    let res: JurorsDrawnQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsDrawn"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getCommits = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let res: JurorsCommitQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsCommit"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getCommitReminders = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsCommitReminderQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsCommitReminder"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}

export const getVotes = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; blockHeight: number; indexLast: any; }
) => {
    let res: JurorsVoteQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsVote"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}


export const getVotesReminders = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsVoteReminderQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsVoteReminder"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}


export const getAppealReminders = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { reminderDeadline: any; timeNow: any; blockHeight: number; idLast: string; blockLast: any; }
) => {
    let res: JurorsAppealReminderQuery | undefined = undefined;
    try {
        res = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsAppealReminder"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return res;
}
