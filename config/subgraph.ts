import { GraphQLClient } from "graphql-request";
import { gnosis, mainnet } from "viem/chains";
import { Sdk as KBSdk, getSdk as getKBSdk} from "../generated/kleros-board-graphql";
import { Sdk as KDSdk, getSdk as getKDSdk} from "../generated/kleros-display-graphql";

const subgraphUrlKD = {
  [mainnet.id]:
    "https://api.thegraph.com/subgraphs/name/andreimvp/kleros-display-mainnet",
  [gnosis.id]:
    "https://api.thegraph.com/subgraphs/name/andreimvp/kleros-display"
} as const;

const subgraphUrlKB = {
  [mainnet.id]:
    "https://api.thegraph.com/subgraphs/name/klerosboard/klerosboard-mainnet",
  [gnosis.id]:
    "https://api.thegraph.com/subgraphs/name/klerosboard/klerosboard-gnosis"
} as const;

export const KBsdks = Object.entries(subgraphUrlKB).reduce(
  (acc, [chainId, url]) => ({
    ...acc,
    [+chainId]: getKBSdk(new GraphQLClient(url)),
  }),
  {} as Record<Supported<(keyof typeof subgraphUrlKB)[]>, KBSdk>
);

export const KDsdks = Object.entries(subgraphUrlKD).reduce(
  (acc, [chainId, url]) => ({
    ...acc,
    [+chainId]: getKDSdk(new GraphQLClient(url)),
  }),
  {} as Record<Supported<(keyof typeof subgraphUrlKD)[]>, KDSdk>
);

export const supportedChainIds = [mainnet.id, gnosis.id];

export const getKDSubgraphData = async (
  chainId: Supported<typeof supportedChainIds>,
  key: keyof KDSdk,
  id: string
  ) => await KDsdks[chainId][key]({ id });

export const getKBSubgraphData = async (
  chainId: Supported<typeof supportedChainIds>,
  key: keyof KBSdk,
  params: any
  ) => await KBsdks[chainId][key](params);