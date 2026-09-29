import { SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          {children}
        </div>
      </main>
    </>
  );
}
