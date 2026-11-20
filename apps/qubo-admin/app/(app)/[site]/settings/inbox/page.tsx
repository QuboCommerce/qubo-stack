import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@qubo/db/client";
import { form, formSubmission } from "@qubo/db/schema";
import { siteInboundAddress } from "@qubo/inbox";
import { emailConfigured, inboundDomain } from "@qubo/inbox/server";
import { asc, count, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { FormSettingsRow } from "@/components/inbox/form-settings";
import { EmptyState, StatusDot } from "@/components/page";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { requireSite } from "@/lib/admin";

function Row({ label, ok, children }: { label: string; ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3.5 sm:px-5">
      <span className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium">
        <StatusDot tone={ok ? "success" : "muted"} />
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[13px] text-muted-foreground">{children}</div>
    </div>
  );
}

export default async function InboxSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings.inbox");
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  if (!(site.capabilities ?? []).includes("leads")) notFound();
  const readOnly = !canManage(site.memberRole);
  const forms = await db
    .select({ id: form.id, key: form.key, name: form.name, notifyEmails: form.notifyEmails, submissions: count(formSubmission.id) })
    .from(form)
    .leftJoin(formSubmission, eq(formSubmission.formId, form.id))
    .where(eq(form.siteId, siteId))
    .groupBy(form.id)
    .orderBy(asc(form.name));
  const outbound = emailConfigured();
  const inbound = inboundDomain();

  return (
    <SettingsPage site={site.slug} title={t("title")} description={t("description")}>
      {readOnly && <ReadOnlyNote />}
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title={t("email")} description={t("emailHelp")}>
          <Surface flush className="divide-y">
            <Row label={t("outboundLabel")} ok={outbound}>
              {outbound ? t("outboundOn") : t("outboundOff", { vars: "RESEND_API_KEY, EMAIL_FROM" })}
            </Row>
            <Row label={t("inboundLabel")} ok={Boolean(inbound)}>
              {inbound ? (
                t.rich("inboundOn", { address: siteInboundAddress(site.slug, inbound), a: (c) => <span className="select-all font-mono text-foreground">{c}</span> })
              ) : (
                t("inboundOff", { vars: "EMAIL_INBOUND_DOMAIN, RESEND_WEBHOOK_SECRET" })
              )}
            </Row>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title={t("forms")} description={t("formsHelp")}>
          <Surface flush className="divide-y">
            {forms.map((f) => (
              <FormSettingsRow key={f.id} site={site.slug} form={f} readOnly={readOnly} />
            ))}
            {forms.length === 0 && <EmptyState icon={FileText} title={t("noForms")} description={t("noFormsHelp")} />}
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
