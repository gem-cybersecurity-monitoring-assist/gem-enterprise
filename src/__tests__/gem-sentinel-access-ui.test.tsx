// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SentinelSecurityPage from "@/app/app/admin/sentinel/page";

const success = (payload:unknown) => ({
  ok:true,status:200,json:async()=>payload,
});
const deny = {ok:false,status:403,json:async()=>({error:"Forbidden"})};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
beforeEach(()=>{vi.clearAllMocks();});

describe("GEM Sentinel accessible operator experience",()=>{
  it("keeps restricted data visibly unavailable instead of claiming protection",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(deny));
    render(<SentinelSecurityPage/>);
    await waitFor(()=>expect(screen.getByText("Restricted")).toBeTruthy());
    expect(screen.getByText(/Protection status: Not yet verified/)).toBeTruthy();
    expect(screen.getByText(/This workspace requires an authenticated Platform Owner account/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/Set up protection/}));
    expect(screen.getByRole("button",{name:/Register disabled connection/}).hasAttribute("disabled")).toBe(true);
  });

  it("renders working tabs and an honest empty collector state",async()=>{
    vi.stubGlobal("fetch",vi.fn((input:string)=>{
      return Promise.resolve(input.includes("/events")?success({events:[]}):success({collectors:[]}));
    }));
    render(<SentinelSecurityPage/>);
    await waitFor(()=>expect(screen.getByText("Accessible")).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"Connections"}));
    expect(screen.getByText("No connections registered")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Incidents"}));
    expect(screen.getByText("No matching stored incidents")).toBeTruthy();
    expect(screen.getByText(/No results is not proof of safety/)).toBeTruthy();
  });

  it("shows a new collector key only after a real successful registration response",async()=>{
    const key="snt_test-key-one-time";
    const fetchMock=vi.fn((input:string,init?:RequestInit)=>{
      if(init?.method==="POST")return Promise.resolve(success({collectorKey:key,id:"case-123"}));
      return Promise.resolve(input.includes("/events")?success({events:[]}):success({collectors:[]}));
    });
    vi.stubGlobal("fetch",fetchMock);
    render(<SentinelSecurityPage/>);
    await waitFor(()=>expect(screen.getByText("Accessible")).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"Connections"}));
    fireEvent.change(screen.getByPlaceholderText("Existing GEM organization"),{target:{value:"tenant_example"}});
    fireEvent.change(screen.getByPlaceholderText("e.g. Authorized Wazuh lab sensor"),{target:{value:"Lab sensor"}});
    fireEvent.change(screen.getByPlaceholderText("Reference held in your approved records"),{target:{value:"CONSENT-LAB-2026-10"}});
    fireEvent.click(screen.getByRole("button",{name:/Register disabled connection/}));
    await waitFor(()=>expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText(key)).toBeTruthy();
    const post=fetchMock.mock.calls.find((call)=>call[1]?.method==="POST");
    expect(post).toBeDefined();
    const payload=JSON.parse(String(post?.[1]?.body));
    expect(payload.tenantId).toBe("tenant_example");
    expect(payload.consentReference).toBe("CONSENT-LAB-2026-10");
    fireEvent.click(screen.getByRole("button",{name:"I saved the key"}));
    expect(screen.queryByText(key)).toBeNull();
  });
});
