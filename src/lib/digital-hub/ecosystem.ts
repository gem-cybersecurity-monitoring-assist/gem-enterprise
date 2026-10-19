export const digitalHubEcosystem = {
  brand: {
    name: "GEM Enterprise",
    publicUrl: "https://www.gemcybersecurityassist.com",
    digitalHubUrl: "https://www.gemcybersecurityassist.com/digital-hub",
    logo: "/gem-wallet-mark.svg",
    walletReturnPath: "/digital-hub#wallets",
  },
  wallets: [
    {
      id: "metamask",
      name: "MetaMask",
      kind: "wallet",
      ecosystems: ["Ethereum", "EVM"],
      connection: "EIP-6963 / EIP-1193 injected provider",
      fallbackUrl: "https://metamask.io/download/",
      state: "live",
    },
    {
      id: "phantom",
      name: "Phantom",
      kind: "wallet",
      ecosystems: ["Solana", "Ethereum"],
      connection: "Injected Phantom provider",
      fallbackUrl: "https://phantom.com/download",
      state: "live",
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet / Base App",
      kind: "wallet",
      ecosystems: ["Ethereum", "Base", "EVM"],
      connection: "EIP-6963 / EIP-1193 injected provider",
      fallbackUrl: "https://wallet.coinbase.com/sign-in",
      state: "live",
    },
    {
      id: "other-web3",
      name: "Other Web3 wallets",
      kind: "multi-wallet",
      ecosystems: ["EVM", "Solana", "Bitcoin", "TON", "TRON"],
      connection: "EIP-6963 discovery + Reown/AppKit expansion gate",
      fallbackUrl: "https://walletguide.walletconnect.network/",
      state: "discovery-live",
    },
  ],
  profiles: [
    {
      id: "farcaster",
      name: "Farcaster",
      kind: "web3-profile",
      href: "https://farcaster.xyz",
      state: "profile-present",
      visibility: "public-profile",
      description:
        "Existing GEM Web3/social profile. The public profile presence is separate from optional Farcaster Mini App wallet-host registration.",
      destinationKind: "provider-home",
      directProfileUrlConfigured: false,
    },
    {
      id: "forex-com",
      name: "FOREX.com",
      kind: "trading-account-profile",
      href: "https://www.forex.com/en/account-login/",
      state: "profile-present",
      visibility: "private-account",
      description:
        "Existing FOREX.com account/profile route. Account details remain private and authentication stays with FOREX.com.",
      destinationKind: "provider-account-login",
      directProfileUrlConfigured: true,
    },
  ],
  marketSources: [
    {
      id: "yahoo-finance",
      name: "Yahoo Finance",
      href: "https://finance.yahoo.com/markets/",
      description: "Market overview for indices, cryptocurrencies, rates, commodities, currencies, and related market data.",
    },
    {
      id: "investopedia",
      name: "Investopedia",
      href: "https://www.investopedia.com/markets-news-4427704",
      description: "Independent market education, explainers, and financial news used as an external research reference.",
    },
    {
      id: "forbes-web3",
      name: "Forbes Web3 / Digital Assets",
      href: "https://www.forbes.com/sites/forbesweb3/",
      description: "External Web3 and digital-assets reporting and community coverage.",
    },
  ],
  community: {
    name: "GEM Enterprise Community Hub",
    href: "https://www.gemcybersecurityassist.com/hub",
    alias: "https://www.gemcybersecurityassist.com/community-hub",
    description:
      "GEM's controlled community destination and the future home of chat, events, member circles, knowledge, and community affairs as those capabilities are verified.",
    communicationReferences: [
      { name: "Discord", state: "placeholder" },
      { name: "Reddit", state: "placeholder" },
      { name: "Slack", state: "placeholder" },
    ],
  },
} as const;

function safeHttpsOverride(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type DigitalHubWalletId = (typeof digitalHubEcosystem.wallets)[number]["id"];
export type DigitalHubProfileId = (typeof digitalHubEcosystem.profiles)[number]["id"];
export type DigitalHubMarketSourceId = (typeof digitalHubEcosystem.marketSources)[number]["id"];

export function getDigitalHubWallet(walletId: string) {
  return digitalHubEcosystem.wallets.find((wallet) => wallet.id === walletId) ?? null;
}


export function getDigitalHubProfile(profileId: string) {
  const profile = digitalHubEcosystem.profiles.find((item) => item.id === profileId);
  if (!profile) return null;

  if (profile.id === "farcaster") {
    const exactProfileUrl = safeHttpsOverride(process.env.FARCASTER_PROFILE_URL);
    return exactProfileUrl
      ? {
          ...profile,
          href: exactProfileUrl,
          destinationKind: "exact-profile" as const,
          directProfileUrlConfigured: true as const,
        }
      : profile;
  }

  if (profile.id === "forex-com") {
    const accountUrl = safeHttpsOverride(process.env.FOREX_ACCOUNT_URL);
    return accountUrl ? { ...profile, href: accountUrl } : profile;
  }

  return profile;
}

export function publicDigitalHubProfiles() {
  return digitalHubEcosystem.profiles.map((profile) => getDigitalHubProfile(profile.id)!);
}

export function getDigitalHubMarketSource(sourceId: string) {
  return digitalHubEcosystem.marketSources.find((source) => source.id === sourceId) ?? null;
}
