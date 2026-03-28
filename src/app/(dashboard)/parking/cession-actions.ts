"use server";

import { buildCessionActions } from "@/lib/actions/cession-actions";

const { createCession, cancelCession, getMyCessions } = buildCessionActions({
  resourceType: "parking",
  noun: "plaza",
  basePath: "/parking",
  logPrefix: "[parking]",
});

export { createCession, cancelCession };
export { getMyCessions as getMyParkingCessions };
