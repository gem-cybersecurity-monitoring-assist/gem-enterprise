// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GemVideoPlayer } from "@/components/video/GemVideoPlayer";

let intersectionCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0.55];
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
}

beforeEach(() => {
  intersectionCallback = null;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GemVideoPlayer", () => {
  it("does not load a third-party frame until the viewer activates playback", () => {
    render(
      <GemVideoPlayer
        src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="Security briefing"
      />,
    );

    expect(screen.queryByTitle("Security briefing")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play Security briefing" }));

    const frame = screen.getByTitle("Security briefing");
    expect(frame.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame.getAttribute("src")).toContain("autoplay=1");
    expect(frame.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("renders native media with mobile playback and caption controls", () => {
    const { container } = render(
      <GemVideoPlayer
        src="https://media.example/briefing.mp4"
        title="Private briefing"
        captionsUrl="/captions/private-briefing.vtt"
      />,
    );
    const video = container.querySelector("video");
    const captions = container.querySelector("track[kind='captions']");
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(captions?.getAttribute("src")).toBe("/captions/private-briefing.vtt");
  });

  it("fails closed without creating links for unsafe fallback URLs", () => {
    render(
      <GemVideoPlayer
        src="javascript:alert(1)"
        externalUrl="javascript:alert(2)"
        title="Unsafe video"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/not supplied a directly playable video format/i)).toBeTruthy();
  });

  it("plays native previews muted in view and pauses them when deactivated", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { container, rerender } = render(
      <GemVideoPlayer
        src="https://media.example/briefing.mp4"
        title="Automatic briefing"
        autoPlayOnScroll
      />,
    );

    await waitFor(() => expect(intersectionCallback).not.toBeNull());
    const target = container.querySelector("video")?.parentElement as Element;
    act(() => {
      intersectionCallback?.([
        { isIntersecting: true, intersectionRatio: 0.8, target } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(container.querySelector("video")?.muted).toBe(true);

    rerender(
      <GemVideoPlayer
        src="https://media.example/briefing.mp4"
        title="Automatic briefing"
        autoPlayOnScroll={false}
      />,
    );
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });

  it("requests muted autoplay for embedded previews but not manual playback", async () => {
    const { container } = render(
      <GemVideoPlayer
        src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="Embedded preview"
        autoPlayOnScroll
      />,
    );

    await waitFor(() => expect(intersectionCallback).not.toBeNull());
    const target = container.querySelector("figure > div") as Element;
    act(() => {
      intersectionCallback?.([
        { isIntersecting: true, intersectionRatio: 0.8, target } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });
    const frame = await screen.findByTitle("Embedded preview");
    expect(frame.getAttribute("src")).toContain("autoplay=1");
    expect(frame.getAttribute("src")).toContain("mute=1");
  });

  it("suppresses autoplay for reduced-motion and data-saving viewers", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const reducedMotion = render(
      <GemVideoPlayer
        src="https://media.example/reduced-motion.mp4"
        title="Reduced motion briefing"
        autoPlayOnScroll
      />,
    );
    await act(async () => undefined);
    expect(intersectionCallback).toBeNull();
    reducedMotion.unmount();

    intersectionCallback = null;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const previousConnection = Object.getOwnPropertyDescriptor(navigator, "connection");
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g", addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    const dataSaving = render(
      <GemVideoPlayer
        src="https://media.example/data-saving.mp4"
        title="Data saving briefing"
        autoPlayOnScroll
      />,
    );
    await act(async () => undefined);
    expect(intersectionCallback).toBeNull();
    dataSaving.unmount();
    if (previousConnection) Object.defineProperty(navigator, "connection", previousConnection);
    else Reflect.deleteProperty(navigator, "connection");
  });
});
