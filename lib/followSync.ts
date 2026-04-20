export const FOLLOW_UPDATED_EVENT = "follow-updated";

export type FollowUpdatedDetail = {
  userId: string;
  following: boolean;
};

export const dispatchFollowUpdated = (detail: FollowUpdatedDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FollowUpdatedDetail>(FOLLOW_UPDATED_EVENT, { detail }));
};
