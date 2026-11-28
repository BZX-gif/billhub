import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { FakeRecognition, installFakeSpeech, removeFakeSpeech, speechResultEvent } from "./helpers";

function setup(onFinal = vi.fn(), onError = vi.fn()) {
  const view = renderHook(() =>
    useSpeechRecognition({
      language: "hi-IN",
      onFinalTranscript: onFinal,
      onError,
      keepAlive: true,
    }),
  );
  return { view, onFinal, onError };
}

describe("resilient speech session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installFakeSpeech();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeFakeSpeech();
    vi.restoreAllMocks();
  });

  it("reports listening once the engine actually starts", () => {
    const { view } = setup();
    act(() => view.result.current.start());
    // The fake engine starts synchronously; either way the session is live.
    expect(["connecting", "listening"]).toContain(view.result.current.status);

    act(() => view.result.current.start()); // second tap is a no-op
    expect(FakeRecognition.instances).toHaveLength(1);

    act(() => FakeRecognition.instances[0]!.onstart?.(new Event("start")));
    expect(view.result.current.status).toBe("listening");
    expect(view.result.current.listening).toBe(true);
    expect(view.result.current.error).toBeNull();
  });

  it("stays on after a silence timeout instead of dying", () => {
    const onFinal = vi.fn();
    const onError = vi.fn();
    const { view } = setup(onFinal, onError);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    // A shopkeeper pauses: the browser ends the session with "no-speech".
    act(() => recognition.onerror?.({ error: "no-speech" }));
    act(() => recognition.onend?.(new Event("end")));

    expect(onError).not.toHaveBeenCalled();
    expect(view.result.current.status).toBe("connecting");

    act(() => vi.advanceTimersByTime(400));
    expect(recognition.started).toBe(true);
  });

  it("recovers from a network blip without scaring the shopkeeper", () => {
    const onFinal = vi.fn();
    const onError = vi.fn();
    const { view } = setup(onFinal, onError);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onerror?.({ error: "network" }));

    // No blocking error: the session says it is recovering and keeps the mic.
    expect(onError).not.toHaveBeenCalled();
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.status).toBe("recovering");
    expect(view.result.current.notice).toMatch(/reconnect/i);

    act(() => vi.advanceTimersByTime(2000));
    expect(recognition.started).toBe(true);
  });

  it("keeps recognising list items after a reconnect", () => {
    const onFinal = vi.fn();
    const { view } = setup(onFinal);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onresult?.(speechResultEvent("3 kilo chini")));
    act(() => recognition.onerror?.({ error: "network" }));
    act(() => recognition.onend?.(new Event("end")));
    act(() => vi.advanceTimersByTime(2000));
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onresult?.(speechResultEvent("aur 2 kilo aata")));

    expect(onFinal.mock.calls.map(([text]) => text)).toEqual(["3 kilo chini", "aur 2 kilo aata"]);
  });

  it("ignores the repeated tail a restarted session often hears again", () => {
    const onFinal = vi.fn();
    const { view } = setup(onFinal);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onresult?.(speechResultEvent("2 kilo aata")));
    act(() => recognition.onend?.(new Event("end")));
    act(() => vi.advanceTimersByTime(400));
    act(() => recognition.onstart?.(new Event("start")));
    act(() => recognition.onresult?.(speechResultEvent("aata")));
    act(() => recognition.onresult?.(speechResultEvent("2 KILO AATA")));

    expect(onFinal).toHaveBeenCalledTimes(1);
  });

  it("never forwards interim text", () => {
    const onFinal = vi.fn();
    const { view } = setup(onFinal);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onresult?.(speechResultEvent("3 kilo chi", false)));
    expect(onFinal).not.toHaveBeenCalled();
    expect(view.result.current.interim).toBe("3 kilo chi");
  });

  it("stops for real when the microphone is blocked", () => {
    const onError = vi.fn();
    const { view } = setup(vi.fn(), onError);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => recognition.onerror?.({ error: "not-allowed" }));

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/microphone access is blocked/i));
    expect(view.result.current.status).toBe("blocked");
    const starts = recognition.startCount;
    act(() => vi.advanceTimersByTime(10000));
    // A blocked microphone must never be retried in a loop.
    expect(recognition.startCount).toBe(starts);
  });

  it("commits nothing while merely reconnecting", () => {
    const onFinal = vi.fn();
    const { view } = setup(onFinal);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));
    act(() => recognition.onerror?.({ error: "network" }));
    act(() => recognition.onerror?.({ error: "no-speech" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("stops cleanly and reports idle", () => {
    const { view } = setup();
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    act(() => view.result.current.stop());
    expect(view.result.current.status).toBe("idle");
    expect(view.result.current.listening).toBe(false);
    const starts = recognition.startCount;
    act(() => recognition.onend?.(new Event("end")));
    act(() => vi.advanceTimersByTime(5000));
    expect(recognition.startCount).toBe(starts);
  });
});

describe("recognition alternatives", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installFakeSpeech();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeFakeSpeech();
    vi.restoreAllMocks();
  });

  it("takes the alternative the engine is most confident about", () => {
    const onFinal = vi.fn();
    const { view } = setup(onFinal);
    act(() => view.result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() => recognition.onstart?.(new Event("start")));

    const result = {
      isFinal: true,
      length: 2,
      0: { transcript: "3 kilo cheeni", confidence: 0.51 },
      1: { transcript: "3 kilo chini", confidence: 0.94 },
    };
    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: Object.assign([result], { length: 1 }),
      });
    });

    expect(onFinal).toHaveBeenCalledWith("3 kilo chini");
  });
});

describe("long shop session", () => {
  beforeEach(() => { vi.useFakeTimers(); installFakeSpeech(); });
  afterEach(() => { vi.useRealTimers(); removeFakeSpeech(); vi.restoreAllMocks(); });

  it("survives two hours of pauses, blips and list items", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ language: "hi-IN", onFinalTranscript: onFinal }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0]!;
    act(() => rec.onstart?.(new Event("start")));

    for (let minute = 0; minute < 120; minute++) {
      act(() => rec.onresult?.(speechResultEvent(`item ${minute} kilo sugar`)));
      if (minute % 7 === 0) act(() => rec.onerror?.({ error: "network" }));
      if (minute % 5 === 0) act(() => rec.onerror?.({ error: "no-speech" }));
      act(() => rec.onend?.(new Event("end")));
      // Let the automatic reconnect happen exactly as it would in a shop.
      act(() => vi.advanceTimersByTime(2500));
      act(() => rec.onstart?.(new Event("start")));
    }

    expect(onFinal).toHaveBeenCalledTimes(120);
    expect(result.current.error).toBeNull();
    // Still alive and listening after two simulated hours of pauses and blips.
    expect(result.current.status).toBe("listening");
  });
});
