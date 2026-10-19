// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CuratedNewsFeed } from "@/components/intel/CuratedNewsFeed";
import type { NewsArticleCardData } from "@/components/intel/NewsArticleCard";

vi.mock("@/components/video/GemVideoPlayer", () => ({
  GemVideoPlayer: ({ title, autoPlayOnScroll }: { title: string; autoPlayOnScroll?: boolean }) => (
    <div data-testid={`player-${title}`} data-autoplay={autoPlayOnScroll ? "true" : "false"} />
  ),
}));

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  targets: Element[];
};

const observers: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [];
  private readonly record: ObserverRecord;
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [] };
    observers.push(this.record);
  }
  disconnect() {}
  observe(target: Element) { this.record.targets.push(target); }
  takeRecords() { return []; }
  unobserve() {}
}

function article(id: string, title: string): NewsArticleCardData {
  return {
    id,
    slug: id,
    title,
    summary: `${title} summary`,
    externalUrl: `https://publisher.example/${id}`,
    category: "cybersecurity",
    tags: [],
    author: null,
    mediaType: "video",
    imageUrl: null,
    imageAlt: title,
    videoUrl: `https://media.example/${id}.mp4`,
    videoThumbnail: null,
    videoProvider: "native",
    isFeatured: false,
    isEditorsPick: false,
    publishedAt: "2026-08-29T12:00:00.000Z",
    source: { id: "source", name: "Publisher", slug: "publisher", siteUrl: "https://publisher.example" },
  };
}

function intersectionEntry(target: Element, intersectionRatio: number): IntersectionObserverEntry {
  const bounds = target.getBoundingClientRect();
  return {
    target,
    isIntersecting: intersectionRatio > 0,
    intersectionRatio,
    boundingClientRect: bounds,
    intersectionRect: bounds,
    rootBounds: null,
    time: 0,
  };
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    items: [article("video-one", "Video one"), article("video-two", "Video two")],
    nextCursor: null,
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GEM News coordinated scroll autoplay", () => {
  it("selects only the highest-visibility video and transfers playback on scroll", async () => {
    const { container } = render(<CuratedNewsFeed categories={[]} />);
    await screen.findByText("Video two");

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-news-video-id]"));
    expect(cards).toHaveLength(2);
    cards[0].getBoundingClientRect = () => ({ top: 100, height: 500 } as DOMRect);
    cards[1].getBoundingClientRect = () => ({ top: 650, height: 500 } as DOMRect);

    await waitFor(() => {
      expect(observers.some((observer) => observer.targets.length === 2)).toBe(true);
    });
    const coordinator = observers.find((observer) => observer.targets.length === 2);
    expect(coordinator).toBeTruthy();

    act(() => {
      coordinator?.callback([
        intersectionEntry(cards[0], 0.82),
        intersectionEntry(cards[1], 0.61),
      ], {} as IntersectionObserver);
    });
    await waitFor(() => expect(screen.getByTestId("player-Video one").dataset.autoplay).toBe("true"));
    expect(screen.getByTestId("player-Video two").dataset.autoplay).toBe("false");

    act(() => {
      coordinator?.callback([
        intersectionEntry(cards[0], 0.3),
        intersectionEntry(cards[1], 0.86),
      ], {} as IntersectionObserver);
    });
    await waitFor(() => expect(screen.getByTestId("player-Video two").dataset.autoplay).toBe("true"));
    expect(screen.getByTestId("player-Video one").dataset.autoplay).toBe("false");
    expect(screen.getAllByText("Muted preview")).toHaveLength(1);
  });
});
