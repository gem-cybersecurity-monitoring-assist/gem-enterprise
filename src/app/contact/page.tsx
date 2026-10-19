import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Clock, AlertTriangle, Shield } from "lucide-react";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact GEM Enterprise for service, support, and partnership inquiries.",
};

const contactDetails = [
  {
    icon: Mail,
    label: "General Inquiries",
    value: "contact@gemcybersecurityassist.com",
    type: "email",
  },
  {
    icon: Mail,
    label: "Security Operations",
    value: "security@gemcybersecurityassist.com",
    type: "email",
  },
  {
    icon: Phone,
    label: "Main Office",
    value: "+1 (401) 702-2460",
    type: "tel",
  },
  {
    icon: Clock,
    label: "Published Support Hours",
    value: "Monday – Friday\n8:00 AM – 6:00 PM Eastern Time",
    type: "hours",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <section className="cyber-grid relative overflow-hidden py-24 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
        <div className="container relative mx-auto px-4 text-center sm:px-6 lg:px-8">
          <Badge className="mb-6 border border-primary/30 bg-primary/10 font-mono text-xs uppercase tracking-widest text-primary">
            Get in Touch
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Get in <span className="text-gradient-primary">Touch</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Service, support, and partnership inquiries. Response timing depends on inquiry type,
            published support coverage, and any applicable service agreement.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold">Send a Message</h2>
                <p className="text-sm text-muted-foreground">
                  Complete the form below and a member of our team will review your inquiry. All fields
                  marked with an asterisk are required.
                </p>
              </div>
              <ContactForm />
            </div>

            <div className="space-y-6">
              <Card className="glass-panel border-border/50">
                <CardContent className="pt-6">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold">
                    <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                    Contact Information
                  </h3>
                  <div className="space-y-5">
                    {contactDetails.map((detail) => {
                      const Icon = detail.icon;
                      return (
                        <div key={detail.label} className="flex gap-3">
                          <div className="h-fit flex-shrink-0 rounded-md border border-primary/20 bg-primary/10 p-1.5">
                            <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                              {detail.label}
                            </p>
                            {detail.type === "email" ? (
                              <a
                                href={`mailto:${detail.value}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {detail.value}
                              </a>
                            ) : detail.type === "tel" ? (
                              <a
                                href={`tel:${detail.value.replace(/[^+\d]/g, "")}`}
                                className="text-sm font-medium transition-colors hover:text-primary"
                              >
                                {detail.value}
                              </a>
                            ) : (
                              <p className="whitespace-pre-line text-sm font-medium">{detail.value}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-5 border-t border-border/50 pt-4 text-xs leading-relaxed text-muted-foreground">
                    Registered, operating, or mailing address details are provided in applicable contracts
                    and verified business documentation rather than inferred from this contact page.
                  </p>
                </CardContent>
              </Card>

              <Separator />

              <Card className="glass-panel border-destructive/30 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-md border border-destructive/30 bg-destructive/10 p-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Security Incident Contact</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Active security incidents and urgent triage requests
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    Active clients should use the escalation contacts and service levels stated in their
                    signed agreement. The public contacts below may be used to request triage, but do not
                    create a guaranteed 24/7 response commitment unless a contract expressly provides it.
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Public Phone
                      </p>
                      <a
                        href="tel:+14017022460"
                        className="text-sm font-bold text-destructive hover:underline"
                      >
                        +1 (401) 702-2460
                      </a>
                    </div>
                    <div>
                      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Security Email
                      </p>
                      <a
                        href="mailto:ir@gemcybersecurityassist.com"
                        className="text-sm font-medium text-destructive hover:underline"
                      >
                        ir@gemcybersecurityassist.com
                      </a>
                    </div>
                  </div>
                  <p className="mt-4 border-t border-destructive/20 pt-4 text-xs text-muted-foreground">
                    For immediate danger or criminal activity, contact local emergency services or the
                    appropriate national cybercrime reporting authority.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-primary/20">
                <CardContent className="pt-6">
                  <h3 className="mb-3 text-sm font-semibold">Response Expectations</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Public response times are targets, not service-level guarantees. Contracted response
                    targets and escalation windows are controlled by the applicable signed agreement.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
