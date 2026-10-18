import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";

const tx = {
  user: { findUnique: vi.fn() }, organization: { findUnique: vi.fn(), create: vi.fn() },
  workspace: { create: vi.fn() }, role: { create: vi.fn() }, workspaceMember: { create: vi.fn() },
  organizationProject: { create: vi.fn() }, auditLog: { create: vi.fn() },
};
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn((callback) => callback(tx)), workspaceMember: { findUnique: vi.fn() } } }));

import { hasWorkspacePermission, isSameOriginWorkspaceRequest, OrganizationWorkspaceError, provisionOrganizationWorkspace, slugifyOrganization } from "@/lib/organizationWorkspace";

function source(path: string) { return readFileSync(path, "utf8"); }

describe("organization workspace operating system", () => {
  beforeEach(() => { vi.clearAllMocks(); tx.user.findUnique.mockResolvedValue({id:"user-1",email:"leonard@example.com",role:"client",status:"active",isActive:true}); tx.organization.findUnique.mockResolvedValue(null); tx.organization.create.mockResolvedValue({id:"org-1",name:"Infinite Wealth & Well-Being",slug:"infinite-wealth-well-being"}); tx.workspace.create.mockResolvedValue({id:"ws-1",organizationId:"org-1",name:"Main Workspace",slug:"main-workspace"}); tx.role.create.mockResolvedValue({id:"role-1",name:"Organization Owner"}); tx.workspaceMember.create.mockResolvedValue({id:"member-1"}); tx.organizationProject.create.mockResolvedValue({id:"project-1"}); tx.auditLog.create.mockResolvedValue({id:"audit-1"}); });

  it("creates stable organization slugs", () => expect(slugifyOrganization("Infinite Wealth & Well-Being")).toBe("infinite-wealth-well-being"));
  it("rejects an unusable organization name", () => expect(() => slugifyOrganization("***")).toThrow("A valid name is required"));
  it("does not infer a permission from a role name", () => {
    const membership = { role: { name:"Organization Owner", permissions:[{action:"view",scope:"workspace"}] } } as never;
    expect(hasWorkspacePermission(membership,"manage","projects")).toBe(false);
    expect(hasWorkspacePermission(membership,"view","workspace")).toBe(true);
  });
  it("requires an explicit valid same-origin browser request for workspace mutations", () => {
    expect(isSameOriginWorkspaceRequest(null,"https://gem.example")).toBe(false);
    expect(isSameOriginWorkspaceRequest("https://evil.example","https://gem.example")).toBe(false);
    expect(isSameOriginWorkspaceRequest("https://gem.example","https://gem.example")).toBe(true);
  });
  it("provisions an isolated workspace for an existing client without changing platform role", async () => {
    const result=await provisionOrganizationWorkspace({organizationName:"Infinite Wealth & Well-Being",workspaceName:"Main Workspace",ownerEmail:"leonard@example.com",projectName:"Infinite Wealth & Well-Being",projectSummary:"Controlled initial project workspace setup.",reason:"Approved initial organization owner access"},"super-1",{ipAddress:"127.0.0.1",userAgent:"test"});
    expect(result.workspace.id).toBe("ws-1");
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({data:{workspaceId:"ws-1",userId:"user-1",roleId:"role-1",status:"active"}});
    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{email:"leonard@example.com"}}));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("refuses to turn a platform administrator into an organization owner through provisioning", async () => {
    tx.user.findUnique.mockResolvedValueOnce({id:"admin-1",email:"admin@example.com",role:"admin",status:"active",isActive:true});
    await expect(provisionOrganizationWorkspace({organizationName:"Unsafe",workspaceName:"Main",ownerEmail:"admin@example.com",reason:"Attempted invalid privilege crossover"},"super-1",{ipAddress:"127.0.0.1",userAgent:"test"})).rejects.toMatchObject({code:"PLATFORM_ROLE_NOT_CLIENT",statusCode:400} satisfies Partial<OrganizationWorkspaceError>);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });
  it("ships a reversible additive migration with workspace foreign keys", () => {
    const migration=source("prisma/migrations/20260813123000_organization_workspace_operating_system/migration.sql");
    expect(migration).toContain('CREATE TABLE "organization_projects"'); expect(migration).toContain('CREATE TABLE "workspace_weekly_updates"');
    expect(migration).toContain('REFERENCES "tokmetric_workspaces"'); expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
  it("keeps login official and routes assigned members through the workspace directory", () => {
    const login=source("src/components/auth/RoleLoginPortal.tsx"); const continuation=source("src/app/access/continue/page.tsx");
    expect(login).toContain('/api/auth/login');
    expect(continuation).toContain("resolveWorkspaceAccess(userId)");
    expect(continuation).toContain('redirect("/app/workspace")');
    expect(continuation).not.toContain('redirect(`/app/workspace?workspace=');
  });
  it("forwards only organization-approved summaries to platform-owner oversight", () => {
    const page=source("src/app/app/admin/organization-reports/page.tsx");
    expect(page).toContain('requirePlatformOwner()'); expect(page).toContain('where:{status:"APPROVED"}'); expect(page).not.toContain('status:"DRAFT"');
  });
  it("uses the authenticated Supabase gateway when direct Prisma is intentionally absent", () => {
    const gateway=source("supabase/functions/gem-workspace-gateway/index.ts");
    const page=source("src/app/app/workspace/page.tsx");
    expect(gateway).toContain('claims.iss!=="gem-auth-gateway"');
    expect(gateway).toContain('await membership(u.id,w,["manage","projects"])');
    expect(gateway).toContain('action==="ai_session"');
    expect(gateway).toContain('action==="ai_message_event"');
    expect(gateway).toContain('profileId:u.id');
    expect(page).toContain('workspaceGateway<');
    expect(page).toContain('gate.session.authSource === "supabase_gateway"');
  });

  it("keeps AI consent receipts and native news ownership explicit",()=>{
    const widget=source("src/components/AIChatWidget.tsx");
    const news=source("src/app/intel/news/page.tsx");
    const gateway=source("supabase/functions/gem-news-gateway/index.ts");
    expect(widget).toContain("DEFAULT_AI_DISCLOSURE_TEXT");
    expect(widget).toContain("process.env.NEXT_PUBLIC_AI_DISCLOSURE_TEXT || DEFAULT_AI_DISCLOSURE_TEXT");
    expect(news).toContain("Native GEM intelligence");
    expect(news).not.toMatch(/iframe|external news host/i);
    expect(gateway).toContain('action === "ingest"');
  });
});
