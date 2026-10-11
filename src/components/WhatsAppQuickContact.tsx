import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const GENERAL_MESSAGE = "Hello GEM, I need help with a service request.";

export function WhatsAppQuickContact() {
  return (
    <a
      href={buildWhatsAppUrl(GENERAL_MESSAGE)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with GEM on WhatsApp"
      className="fixed bottom-5 right-5 z-[9990] inline-flex h-14 items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500 px-4 text-sm font-bold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 md:bottom-7 md:right-7"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
