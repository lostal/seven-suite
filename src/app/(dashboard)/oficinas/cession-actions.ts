"use server";

import { buildCessionActions } from "@/lib/actions/cession-actions";

const { createCession, cancelCession, getMyCessions } = buildCessionActions({
  resourceType: "office",
  noun: "puesto",
  basePath: "/oficinas",
  logPrefix: "[oficinas]",
});

export {
  createCession as createOfficeCession,
  cancelCession as cancelOfficeCession,
};
export { getMyCessions as getMyOfficeCessions };
