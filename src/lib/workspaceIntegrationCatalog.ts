export type WorkspaceIntegrationReadiness =
  | "AVAILABLE"
  | "READY"
  | "PARTIAL"
  | "HUMAN_REQUIRED"
  | "BLOCKED";

export interface WorkspaceIntegrationItem {
  id: string;
  href: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readiness: WorkspaceIntegrationReadiness;
  logoDomain: string;
  kind: "CATALOG" | "GEM_SURFACE";
}

type ProviderSeed = readonly [name: string, domain: string];

const providerGroups = [
  {
    category: "Marketing & sales",
    providers: [
      ["HubSpot", "hubspot.com"], ["Salesforce", "salesforce.com"], ["Pipedrive", "pipedrive.com"],
      ["Zoho CRM", "zoho.com"], ["Mailchimp", "mailchimp.com"], ["Klaviyo", "klaviyo.com"],
      ["Marketo", "marketo.com"], ["ActiveCampaign", "activecampaign.com"], ["Brevo", "brevo.com"],
      ["Apollo", "apollo.io"], ["Outreach", "outreach.io"], ["Salesloft", "salesloft.com"],
      ["Intercom", "intercom.com"], ["Typeform", "typeform.com"], ["Jotform", "jotform.com"],
      ["Unbounce", "unbounce.com"], ["Semrush", "semrush.com"], ["Ahrefs", "ahrefs.com"],
      ["Google Ads", "ads.google.com"], ["Meta Business", "business.facebook.com"], ["LinkedIn Ads", "business.linkedin.com"],
      ["TikTok for Business", "ads.tiktok.com"], ["Hootsuite", "hootsuite.com"], ["Buffer", "buffer.com"],
      ["Sprout Social", "sproutsocial.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Productivity & collaboration",
    providers: [
      ["Slack", "slack.com"], ["Microsoft Teams", "teams.microsoft.com"], ["Google Workspace", "workspace.google.com"],
      ["Microsoft 365", "microsoft365.com"], ["Notion", "notion.so"], ["Airtable", "airtable.com"],
      ["Asana", "asana.com"], ["Monday.com", "monday.com"], ["ClickUp", "clickup.com"],
      ["Trello", "trello.com"], ["Basecamp", "basecamp.com"], ["Miro", "miro.com"],
      ["Coda", "coda.io"], ["Confluence", "atlassian.com"], ["Jira", "jira.com"],
      ["Linear", "linear.app"], ["Todoist", "todoist.com"], ["Smartsheet", "smartsheet.com"],
      ["Wrike", "wrike.com"], ["Teamwork", "teamwork.com"], ["Quip", "quip.com"],
      ["Dropbox Paper", "paper.dropbox.com"], ["Fibery", "fibery.io"], ["Height", "height.app"],
      ["Aha!", "aha.io"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Development & delivery",
    providers: [
      ["GitHub", "github.com"], ["GitLab", "gitlab.com"], ["Bitbucket", "bitbucket.org"],
      ["Vercel", "vercel.com"], ["Netlify", "netlify.com"], ["Render", "render.com"],
      ["Railway", "railway.app"], ["Heroku", "heroku.com"], ["CircleCI", "circleci.com"],
      ["Travis CI", "travis-ci.com"], ["Jenkins", "jenkins.io"], ["Buildkite", "buildkite.com"],
      ["Sentry", "sentry.io"], ["Datadog", "datadoghq.com"], ["New Relic", "newrelic.com"],
      ["PagerDuty", "pagerduty.com"], ["Opsgenie", "opsgenie.com"], ["Postman", "postman.com"],
      ["Insomnia", "insomnia.rest"], ["Docker", "docker.com"], ["Kubernetes", "kubernetes.io"],
      ["Terraform", "terraform.io"], ["Pulumi", "pulumi.com"], ["Snyk", "snyk.io"],
      ["SonarQube", "sonarqube.org"], ["LaunchDarkly", "launchdarkly.com"], ["Split", "split.io"],
      ["Grafana", "grafana.com"], ["Better Stack", "betterstack.com"], ["Honeycomb", "honeycomb.io"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Data & analytics",
    providers: [
      ["Google Analytics", "analytics.google.com"], ["Mixpanel", "mixpanel.com"], ["Amplitude", "amplitude.com"],
      ["PostHog", "posthog.com"], ["Segment", "segment.com"], ["Snowflake", "snowflake.com"],
      ["Databricks", "databricks.com"], ["BigQuery", "cloud.google.com"], ["Tableau", "tableau.com"],
      ["Power BI", "powerbi.microsoft.com"], ["Looker", "looker.com"], ["Metabase", "metabase.com"],
      ["Mode", "mode.com"], ["Hex", "hex.tech"], ["Domo", "domo.com"],
      ["Fivetran", "fivetran.com"], ["Airbyte", "airbyte.com"], ["dbt Cloud", "getdbt.com"],
      ["Matillion", "matillion.com"], ["Alteryx", "alteryx.com"], ["Heap", "heap.io"],
      ["Hotjar", "hotjar.com"], ["FullStory", "fullstory.com"], ["Plausible", "plausible.io"],
      ["Kissmetrics", "kissmetrics.io"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Finance & billing",
    providers: [
      ["Stripe", "stripe.com"], ["PayPal", "paypal.com"], ["Square", "squareup.com"],
      ["Adyen", "adyen.com"], ["Braintree", "braintreepayments.com"], ["GoCardless", "gocardless.com"],
      ["QuickBooks", "quickbooks.intuit.com"], ["Xero", "xero.com"], ["FreshBooks", "freshbooks.com"],
      ["Sage", "sage.com"], ["Wave", "waveapps.com"], ["Chargebee", "chargebee.com"],
      ["Recurly", "recurly.com"], ["Paddle", "paddle.com"], ["Zuora", "zuora.com"],
      ["Ramp", "ramp.com"], ["Brex", "brex.com"], ["Expensify", "expensify.com"],
      ["Wise Business", "wise.com"], ["Plaid", "plaid.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Customer support",
    providers: [
      ["Zendesk", "zendesk.com"], ["Freshdesk", "freshdesk.com"], ["Help Scout", "helpscout.com"],
      ["Gorgias", "gorgias.com"], ["Kustomer", "kustomer.com"], ["Front", "front.com"],
      ["Gladly", "gladly.com"], ["Dixa", "dixa.com"], ["LiveChat", "livechat.com"],
      ["Tidio", "tidio.com"], ["Crisp", "crisp.chat"], ["Drift", "drift.com"],
      ["UserVoice", "uservoice.com"], ["Canny", "canny.io"], ["Delighted", "delighted.com"],
      ["SurveyMonkey", "surveymonkey.com"], ["Qualtrics", "qualtrics.com"], ["Statuspage", "statuspage.io"],
      ["Statuspal", "statuspal.io"], ["Groove", "groovehq.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Communications",
    providers: [
      ["Gmail", "gmail.com"], ["Outlook", "outlook.com"], ["Zoom", "zoom.us"],
      ["Google Meet", "meet.google.com"], ["Twilio", "twilio.com"], ["SendGrid", "sendgrid.com"],
      ["Mailgun", "mailgun.com"], ["Postmark", "postmarkapp.com"], ["Amazon SES", "aws.amazon.com"],
      ["Vonage", "vonage.com"], ["RingCentral", "ringcentral.com"], ["Dialpad", "dialpad.com"],
      ["Aircall", "aircall.io"], ["Loom", "loom.com"], ["Calendly", "calendly.com"],
      ["Cal.com", "cal.com"], ["Telegram", "telegram.org"], ["WhatsApp Business", "business.whatsapp.com"],
      ["Discord", "discord.com"], ["Webex", "webex.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Security & identity",
    providers: [
      ["Okta", "okta.com"], ["Auth0", "auth0.com"], ["Microsoft Entra", "entra.microsoft.com"],
      ["OneLogin", "onelogin.com"], ["JumpCloud", "jumpcloud.com"], ["Duo", "duo.com"],
      ["1Password", "1password.com"], ["Bitwarden", "bitwarden.com"], ["LastPass", "lastpass.com"],
      ["Dashlane", "dashlane.com"], ["Cloudflare Zero Trust", "cloudflare.com"], ["CrowdStrike", "crowdstrike.com"],
      ["SentinelOne", "sentinelone.com"], ["Palo Alto Networks", "paloaltonetworks.com"], ["Zscaler", "zscaler.com"],
      ["Tenable", "tenable.com"], ["Rapid7", "rapid7.com"], ["Splunk", "splunk.com"],
      ["Elastic Security", "elastic.co"], ["Wiz", "wiz.io"], ["Drata", "drata.com"],
      ["Vanta", "vanta.com"], ["Secureframe", "secureframe.com"], ["Aikido Security", "aikido.dev"],
      ["Keeper", "keepersecurity.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Cloud & infrastructure",
    providers: [
      ["Amazon Web Services", "aws.amazon.com"], ["Microsoft Azure", "azure.microsoft.com"], ["Google Cloud", "cloud.google.com"],
      ["DigitalOcean", "digitalocean.com"], ["Linode", "linode.com"], ["OVHcloud", "ovhcloud.com"],
      ["Oracle Cloud", "oracle.com"], ["IBM Cloud", "ibm.com"], ["Akamai", "akamai.com"],
      ["Fastly", "fastly.com"], ["MongoDB Atlas", "mongodb.com"], ["Supabase", "supabase.com"],
      ["Firebase", "firebase.google.com"], ["PlanetScale", "planetscale.com"], ["Neon", "neon.tech"],
      ["Redis", "redis.io"], ["CockroachDB", "cockroachlabs.com"], ["Confluent", "confluent.io"],
      ["Elastic Cloud", "elastic.co"], ["Wasabi", "wasabi.com"], ["Backblaze", "backblaze.com"],
      ["Amazon S3", "s3.amazonaws.com"], ["Azure Storage", "azure.microsoft.com"], ["Cloudinary", "cloudinary.com"],
      ["Imgix", "imgix.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "AI & automation",
    providers: [
      ["OpenAI", "openai.com"], ["Anthropic", "anthropic.com"], ["Google Gemini", "gemini.google.com"],
      ["Microsoft Copilot", "copilot.microsoft.com"], ["Perplexity", "perplexity.ai"], ["Hugging Face", "huggingface.co"],
      ["Cohere", "cohere.com"], ["Mistral AI", "mistral.ai"], ["Groq", "groq.com"],
      ["Replicate", "replicate.com"], ["Together AI", "together.ai"], ["Pinecone", "pinecone.io"],
      ["Weaviate", "weaviate.io"], ["Qdrant", "qdrant.tech"], ["Zapier", "zapier.com"],
      ["Make", "make.com"], ["n8n", "n8n.io"], ["Workato", "workato.com"],
      ["Tray.io", "tray.io"], ["Pipedream", "pipedream.com"], ["UiPath", "uipath.com"],
      ["Automation Anywhere", "automationanywhere.com"], ["LangChain", "langchain.com"], ["LlamaIndex", "llamaindex.ai"],
      ["ElevenLabs", "elevenlabs.io"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Design & creative",
    providers: [
      ["Figma", "figma.com"], ["Canva", "canva.com"], ["Adobe Creative Cloud", "adobe.com"],
      ["Framer", "framer.com"], ["Webflow", "webflow.com"], ["Sketch", "sketch.com"],
      ["InVision", "invisionapp.com"], ["Zeplin", "zeplin.io"], ["LottieFiles", "lottiefiles.com"],
      ["Mural", "mural.co"], ["Descript", "descript.com"], ["Vimeo", "vimeo.com"],
      ["YouTube", "youtube.com"], ["Wistia", "wistia.com"], ["Riverside", "riverside.fm"],
      ["Runway", "runwayml.com"], ["Midjourney", "midjourney.com"], ["Unsplash", "unsplash.com"],
      ["Shutterstock", "shutterstock.com"], ["CloudConvert", "cloudconvert.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Commerce & operations",
    providers: [
      ["Shopify", "shopify.com"], ["WooCommerce", "woocommerce.com"], ["BigCommerce", "bigcommerce.com"],
      ["Magento", "business.adobe.com"], ["Etsy", "etsy.com"], ["Amazon Seller Central", "sellercentral.amazon.com"],
      ["eBay", "ebay.com"], ["Walmart Marketplace", "marketplace.walmart.com"], ["ShipStation", "shipstation.com"],
      ["Shippo", "goshippo.com"], ["EasyPost", "easypost.com"], ["AfterShip", "aftership.com"],
      ["Cin7", "cin7.com"], ["Katana", "katanamrp.com"], ["Odoo", "odoo.com"],
      ["SAP", "sap.com"], ["Oracle NetSuite", "netsuite.com"], ["ServiceNow", "servicenow.com"],
      ["Square Online", "squareup.com"], ["Lightspeed", "lightspeedhq.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "HR & people",
    providers: [
      ["Workday", "workday.com"], ["BambooHR", "bamboohr.com"], ["Rippling", "rippling.com"],
      ["Gusto", "gusto.com"], ["Deel", "deel.com"], ["Remote", "remote.com"],
      ["Greenhouse", "greenhouse.io"], ["Lever", "lever.co"], ["Ashby", "ashbyhq.com"],
      ["SmartRecruiters", "smartrecruiters.com"], ["iCIMS", "icims.com"], ["Personio", "personio.com"],
      ["HiBob", "hibob.com"], ["Lattice", "lattice.com"], ["Culture Amp", "cultureamp.com"],
      ["15Five", "15five.com"], ["Leapsome", "leapsome.com"], ["Deputy", "deputy.com"],
      ["When I Work", "wheniwork.com"], ["UKG", "ukg.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Crypto & Web3",
    providers: [
      ["Coinbase", "coinbase.com"], ["Kraken", "kraken.com"], ["Binance", "binance.com"],
      ["Gemini Exchange", "gemini.com"], ["Crypto.com", "crypto.com"], ["CoinMarketCap", "coinmarketcap.com"],
      ["CoinGecko", "coingecko.com"], ["MetaMask", "metamask.io"], ["WalletConnect", "walletconnect.com"],
      ["Ledger", "ledger.com"], ["Trezor", "trezor.io"], ["Alchemy", "alchemy.com"],
      ["Infura", "infura.io"], ["QuickNode", "quicknode.com"], ["Chainalysis", "chainalysis.com"],
      ["Fireblocks", "fireblocks.com"], ["BitGo", "bitgo.com"], ["OpenSea", "opensea.io"],
      ["Etherscan", "etherscan.io"], ["Dune", "dune.com"],
    ] satisfies ProviderSeed[],
  },
  {
    category: "Wellbeing & health",
    providers: [
      ["Apple Health", "apple.com"], ["Google Fit", "google.com"], ["Fitbit", "fitbit.com"],
      ["Garmin Connect", "garmin.com"], ["WHOOP", "whoop.com"], ["Oura", "ouraring.com"],
      ["Strava", "strava.com"], ["MyFitnessPal", "myfitnesspal.com"], ["Headspace", "headspace.com"],
      ["Calm", "calm.com"], ["BetterUp", "betterup.com"], ["Virgin Pulse", "personifyhealth.com"],
      ["Wellable", "wellable.co"], ["Mindbody", "mindbodyonline.com"], ["Jane", "jane.app"],
      ["SimplePractice", "simplepractice.com"], ["Healthie", "gethealthie.com"], ["Cronometer", "cronometer.com"],
      ["Peloton", "onepeloton.com"], ["ClassPass", "classpass.com"],
    ] satisfies ProviderSeed[],
  },
] as const;

const categoryDescriptions: Record<string, string> = {
  "Marketing & sales": "Coordinate governed customer acquisition, campaigns, pipeline, and relationship workflows.",
  "Productivity & collaboration": "Bring approved planning, documentation, projects, and teamwork into the workspace.",
  "Development & delivery": "Connect governed software delivery, source, release, observability, and incident workflows.",
  "Data & analytics": "Make approved data, reporting, product analytics, and decision-support services discoverable.",
  "Finance & billing": "Route authorized billing, accounting, expenses, and payment operations through controlled adapters.",
  "Customer support": "Coordinate approved service desks, feedback, status, and customer-care workflows.",
  Communications: "Connect authorized email, meetings, messaging, telephony, and scheduling services.",
  "Security & identity": "Surface governed identity, access, security monitoring, compliance, and credential services.",
  "Cloud & infrastructure": "Connect approved compute, edge, database, storage, and platform infrastructure.",
  "AI & automation": "Make approved AI, agent, model, vector, and workflow automation services discoverable.",
  "Design & creative": "Coordinate authorized design, media, video, asset, and creative production workflows.",
  "Commerce & operations": "Connect approved commerce, inventory, fulfilment, ERP, and service operations.",
  "HR & people": "Coordinate authorized recruiting, workforce, payroll, performance, and people operations.",
  "Crypto & Web3": "Surface governed crypto intelligence, custody, infrastructure, and wallet services without enabling transactions.",
  "Wellbeing & health": "Connect consent-based wellbeing, activity, coaching, and user-managed health-data services.",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const workspaceIntegrationCatalog: WorkspaceIntegrationItem[] = providerGroups.flatMap(
  ({ category, providers }) =>
    providers.map(([title, logoDomain]) => {
      const id = slugify(`${category}-${title}`);
      return {
        id,
        href: `/app/command-center/integrations?connector=${encodeURIComponent(id)}`,
        title,
        description: categoryDescriptions[category],
        category,
        status: "Available for governed workspace connection",
        readiness: "AVAILABLE" as const,
        logoDomain,
        kind: "CATALOG" as const,
      };
    }),
);

export function mergeWorkspaceIntegrations(
  operationalItems: WorkspaceIntegrationItem[],
  catalogItems: WorkspaceIntegrationItem[] = workspaceIntegrationCatalog,
) {
  const operationalDomains = new Set(operationalItems.map((item) => item.logoDomain));
  return [
    ...operationalItems,
    ...catalogItems.filter((item) => !operationalDomains.has(item.logoDomain)),
  ];
}
