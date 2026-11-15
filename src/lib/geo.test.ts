import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturePreciseLocation } from "@/lib/geo";

type Success = (pos: GeolocationPosition) => void;
type Failure = (err: GeolocationPositionError) => void;

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;

let success: Success;
let failure: Failure;
const clearWatch = vi.fn();

function fix(lat: number, accuracy: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: 36.8, accuracy } } as GeolocationPosition;
}

function error(code: number): GeolocationPositionError {
  return { code, message: "x", PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT: 3 } as GeolocationPositionError;
}

beforeEach(() => {
  vi.useFakeTimers();
  clearWatch.mockClear();
  vi.stubGlobal("window", {
    isSecureContext: true,
    GeolocationPositionError: { PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT: 3 },
  });
  vi.stubGlobal("navigator", {
    geolocation: {
      watchPosition: (ok: Success, fail: Failure) => {
        success = ok;
        failure = fail;
        return 7;
      },
      clearWatch,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("capturePreciseLocation", () => {
  it("keeps watching past a rough first fix and stops once it is precise", async () => {
    const updates: number[] = [];
    const result = capturePreciseLocation({ onUpdate: (f) => updates.push(f.accuracy ?? -1) });
    success(fix(-1.1, 900));
    success(fix(-1.2, 120));
    success(fix(-1.3, 12));
    const loc = await result;
    expect(loc.lat).toBe(-1.3);
    expect(loc.accuracy).toBe(12);
    expect(updates).toEqual([900, 120, 12]);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("settles for the best fix when the time runs out", async () => {
    const result = capturePreciseLocation({ maxWaitMs: 5000 });
    success(fix(-1.1, 400));
    success(fix(-1.2, 60));
    success(fix(-1.3, 300)); // worse - ignored
    vi.advanceTimersByTime(5000);
    const loc = await result;
    expect(loc.lat).toBe(-1.2);
    expect(loc.accuracy).toBe(60);
  });

  it("rejects when permission is denied", async () => {
    const result = capturePreciseLocation();
    failure(error(PERMISSION_DENIED));
    await expect(result).rejects.toMatchObject({ code: PERMISSION_DENIED });
  });

  it("keeps the fix it has when a later reading fails", async () => {
    const result = capturePreciseLocation({ maxWaitMs: 5000 });
    success(fix(-1.2, 80));
    failure(error(POSITION_UNAVAILABLE));
    vi.advanceTimersByTime(5000);
    await expect(result).resolves.toMatchObject({ lat: -1.2, accuracy: 80 });
  });
});
