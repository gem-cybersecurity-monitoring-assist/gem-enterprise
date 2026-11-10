import { describe, expect, it, vi } from "vitest";
import {
  getPublicDirectory,
  isApprovedPublicDirectoryPage,
  parsePublicDirectoryPage,
} from "./notion-public-directory";

const richText = (s: string) => ({ rich_text: [{ plain_text: s }] });
const title = (s: string) => ({ title: [{ plain_text: s }] });
const select = (s: string) => ({ select: { name: s } });
const multiSelect = (values: string[]) => ({ multi_select: values.map(name => ({ name })) });
const date = (s: string) => ({ date: { start: s } });

function page(overrides: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
  return {
    id: "person-1",
    properties: {
      "Profile / Function": title("Approved Professional"),
      "Profile ID": { unique_id: { number: 1 } },
      Type: select("Human"),
      Role: richText("Security Assurance"),
      Division: select("Cybersecurity"),
      "Public Bio": richText("Approved public profile text"),
      "Website Visibility": select("Public"),
      Audience: multiSelect(["Public"]),
      "Publish Approved": { checkbox: true },
      "CEO Approval": select("Approved"),
      "Verification Status": select("Verified"),
      Reviewer: { people: [{ id: "reviewer-1" }] },
      "Last Verified": date("2026-01-20"),
      "Public License Display": select("Verified"),
      "License Type": richText("Public Professional License"),
      "Licensing Authority": richText("Registered Authority"),
      "License Jurisdiction": richText("Florida"),
      "License Number": richText("private-number"),
      "Evidence Files": { files: [{ name: "private.pdf" }] },
      "Internal Notes": richText("secret reviewer note"),
      ...overrides,
    },
    ...fields,
  };
}

describe("real Notion production directory publishing", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("reads production schema names, including title and public bio, without exposing private fields", () => {
    const result = parsePublicDirectoryPage(page(), now);
    expect(result).toMatchObject({
      name: "Approved Professional", role: "Security Assurance",
      division: "Cybersecurity", profileType: "Human",
      bio: "Approved public profile text", verificationStatus: "Verified",
      licenseType: "Public Professional License", licenseAuthority: "Registered Authority",
      licenseJurisdiction: "Florida",
    });
    expect(result).not.toHaveProperty("licenseNumber");
    expect(result).not.toHaveProperty("internalNotes");
    expect(result).not.toHaveProperty("evidenceFiles");
    expect(result).not.toHaveProperty("reviewer");
  });

  it("fails closed on every publication permission and evidence requirement", () => {
    const disallowed = [
      { "Publish Approved": { checkbox: false } },
      { "Website Visibility": select("Hidden") },
      { Audience: multiSelect(["Internal"]) },
      { Audience: multiSelect(["Public", "VIP"]) },
      { Audience: multiSelect(["Public", "Client"]) },
      { Audience: select("Public") }, // production Audience is multi_select
      { Type: select("AI") },
      { "CEO Approval": select("Pending") },
      { "Verification Status": select("Evidence Required") },
      { Reviewer: { people: [] } },
      { "Last Verified": { date: null } },
      { "Last Verified": date("2028-02-01") },
      { Expires: date("2026-10-30") },
    ];
    for(const override of disallowed) {
      expect(isApprovedPublicDirectoryPage(page(override), now), JSON.stringify(override)).toBe(false);
    }
    expect(isApprovedPublicDirectoryPage(page({}, {archived: true}), now)).toBe(false);
    expect(isApprovedPublicDirectoryPage(page({}, {in_trash: true}), now)).toBe(false);
    expect(isApprovedPublicDirectoryPage(page({Expires:date("2026-11-10")}), now)).toBe(true);
  });

  it("does not claim professional license verification before separate license approval", () => {
    const r = parsePublicDirectoryPage(page({ "Public License Display": select("Pending") }), now);
    expect(r).toMatchObject({
      licenseType: null, licenseAuthority: null, licenseJurisdiction: null,
    });
  });

  it("fails closed when no Notion runtime credentials are present", async () => {
    const request = vi.fn();
    expect(await getPublicDirectory({}, request as unknown as typeof fetch)).toEqual({
      configured:false,profiles:[],status:"not_configured",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("filters Notion by all critical publication properties and never requests private data by name", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({results:[page()],has_more:false}),{status:200}),
    );
    const r=await getPublicDirectory(
      {NOTION_API_TOKEN:"test-notion-token",NOTION_PERSONNEL_DATA_SOURCE_ID:"collection://7b16d9de-a86e-4aed-8ab7-7c9b937d3abc"},
      request as unknown as typeof fetch,
    );
    expect(r.status).toBe("ready");
    expect(r.profiles).toHaveLength(1);
    expect(request.mock.calls[0][0]).toContain("/data_sources/7b16d9de-a86e-4aed-8ab7-7c9b937d3abc/query");
    const opts = request.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(opts.body));
    expect(body.filter.and).toEqual(expect.arrayContaining([
      {property:"Publish Approved",checkbox:{equals:true}},
      {property:"Website Visibility",select:{equals:"Public"}},
      {property:"CEO Approval",select:{equals:"Approved"}},
      {property:"Verification Status",select:{equals:"Verified"}},
      {property:"Audience",multi_select:{contains:"Public"}},
    ]));
    expect(JSON.stringify(r)).not.toContain("private-number");
  });

  it("handles pagination and screens every record even if the API returns unapproved rows", async () => {
    const req=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({results:[page({ "Publish Approved": { checkbox:false } })],has_more:true,next_cursor:"next-page"}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({results:[page()],has_more:false}),{status:200}));
    const r=await getPublicDirectory({NOTION_API_TOKEN:"test",NOTION_PERSONNEL_DATA_SOURCE_ID:"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc"},req as unknown as typeof fetch);
    expect(r.status).toBe("ready");
    expect(r.profiles).toHaveLength(1);
    expect(req).toHaveBeenCalledTimes(2);
    expect(JSON.parse(req.mock.calls[1][1].body).start_cursor).toBe("next-page");
  });

  it("fails closed on provider errors, malformed responses, or incomplete paging", async () => {
    const env={NOTION_API_TOKEN:"test",NOTION_PERSONNEL_DATA_SOURCE_ID:"7b16d9de-a86e-4aed-8ab7-7c9b937d3abc"};
    for(const response of [
      new Response("denied",{status:403}),
      new Response(JSON.stringify({results:"invalid"}),{status:200}),
      new Response(JSON.stringify({results:[page()],has_more:true}),{status:200}),
    ]) {
      const request=vi.fn().mockResolvedValue(response);
      expect(await getPublicDirectory(env,request as unknown as typeof fetch)).toEqual({
        configured:true, profiles:[], status:"provider_error",
      });
    }
  });
});
