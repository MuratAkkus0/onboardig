export const NAMESPACES = [
  "common enums nav auth profile errors validation emails notificationItems org users library editor notifications events templates plan dashboard search",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
