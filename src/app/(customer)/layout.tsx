import { SiteHeader } from "@/components/site-header";

// Customer-facing chrome; staff routes under /admin get their own layout.
export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
