import { isLiveTrainingV2Enabled } from "@/server/features/liveTrainingV2";

describe("release feature flags", () => {
  it("keeps Live Training V2 fail-closed unless explicitly enabled", () => {
    expect(isLiveTrainingV2Enabled({})).toBe(false);
    expect(isLiveTrainingV2Enabled({ LIVE_TRAINING_V2: "false" })).toBe(false);
    expect(isLiveTrainingV2Enabled({ LIVE_TRAINING_V2: "true" })).toBe(true);
  });
});
