import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet } from "viem/chains";
import {
    AppealPossibleQuery,
    NewDisputesQuery,
    JurorsDrawnQuery,
    Sdk,
    getSdk,
} from "../generated/kleros-v1-notifications";
import { Supported } from "../types";
import { Address } from "viem";

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
    params: { skip: number;  BNLow: BigInt; BNHigh: BigInt; disputeIDLast: BigInt;}
) => {
    let appealableDisputes: AppealPossibleQuery | undefined = undefined;
    try {
        appealableDisputes = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["AppealPossible"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return appealableDisputes;
}

export const getNewDisputes = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { skip: number; blockHeight: number, disputeID: number;}
) => {
    let newDisputes: NewDisputesQuery | undefined = undefined;
    try {
        newDisputes = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["NewDisputes"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return newDisputes;
}

export const getDraws = async (
    chainId: Supported<typeof supportedChainIds>,
    params: { first: number; skip: number; reminderDeadline: any; BNLow: any; BNHigh: any; }
) => {
    let draws: JurorsDrawnQuery | undefined = undefined;
    try {
        draws = await sdks[chainId as Supported<(keyof typeof subgraphUrl)[]>]["JurorsDrawn"](
            params
        );
    } catch (e) {
        console.error(e);
    }
    return draws;
}