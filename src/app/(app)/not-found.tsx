import { NotFoundContent } from "@/components/common/not-found-content";

/** 404 inside the app shell: no second `main` landmark. */
export default function AppNotFound() {
  return <NotFoundContent as="div" />;
}
