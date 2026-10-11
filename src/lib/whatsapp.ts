export const whatsappBusiness = {
  displayNumber: "+1 (860) 234-9394",
  digits: "18602349394",
  peachMode: "Coexistence",
  channelLabel: "GEM WhatsApp Business",
} as const;

export type WhatsAppServiceKey =
  | "general"
  | "cybersecurity"
  | "real-estate"
  | "finance-compliance"
  | "logistics"
  | "community"
  | "appointment"
  | "documents";

export const whatsappServicePrompts: Record<
  WhatsAppServiceKey,
  { label: string; description: string; message: string }
> = {
  general: {
    label: "General support",
    description: "Service questions, routing, and non-sensitive support.",
    message: "Hello GEM, I need help with a service request.",
  },
  cybersecurity: {
    label: "Cybersecurity",
    description: "Cybersecurity, digital-risk, monitoring, and incident-support intake.",
    message: "Hello GEM, I would like help with a cybersecurity or digital-risk matter.",
  },
  "real-estate": {
    label: "Real estate",
    description: "Property, real-estate service, and asset-risk inquiries.",
    message: "Hello GEM, I would like help with a real-estate service or property inquiry.",
  },
  "finance-compliance": {
    label: "Finance & compliance",
    description: "Finance, compliance, and regulated-service routing.",
    message: "Hello GEM, I would like help with a finance or compliance matter.",
  },
  logistics: {
    label: "Logistics",
    description: "Logistics and operational service inquiries.",
    message: "Hello GEM, I would like help with a logistics or operations request.",
  },
  community: {
    label: "Community",
    description: "GEM Community questions, events, and member routing.",
    message: "Hello GEM, I would like help with a GEM Community question or event.",
  },
  appointment: {
    label: "Appointments",
    description: "Schedule, confirm, or reschedule a consultation.",
    message: "Hello GEM, I would like to schedule or manage a consultation.",
  },
  documents: {
    label: "Document assistance",
    description: "Help locating or understanding a service document.",
    message: "Hello GEM, I need help with a document related to my service request.",
  },
};

export function buildWhatsAppUrl(message: string, digits = whatsappBusiness.digits) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
