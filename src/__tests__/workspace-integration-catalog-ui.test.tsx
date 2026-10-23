// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceIntegrationCatalog } from "@/components/command-center/WorkspaceIntegrationCatalog";
import { workspaceIntegrationCatalog } from "@/lib/workspaceIntegrationCatalog";

describe("WorkspaceIntegrationCatalog", () => {
  it("renders a progressive, uniformly branded 300+ connector directory", () => {
    const { container } = render(<WorkspaceIntegrationCatalog items={workspaceIntegrationCatalog} />);

    expect(screen.getByText(/Search and preview 340 provider applications/i)).toBeTruthy();
    expect(screen.getByText("48 shown")).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(48);
    expect(container.querySelectorAll('img[alt$=" logo"]')).toHaveLength(48);
    expect(screen.getByRole("button", { name: "Show 48 more" })).toBeTruthy();
  });

  it("makes every app reachable through search and opens its governed preview", () => {
    render(<WorkspaceIntegrationCatalog items={workspaceIntegrationCatalog} />);

    fireEvent.change(screen.getByPlaceholderText("Search integrations"), {
      target: { value: "CoinMarketCap" },
    });

    expect(screen.getByText("CoinMarketCap")).toBeTruthy();
    expect(screen.getByText("1 connector")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/workspace administrator must approve provider terms/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Open governed surface/i })).toBeNull();
  });
});
