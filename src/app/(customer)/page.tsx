import type { Metadata } from "next";
import { CustomerChat } from "@/components/chat/customer-chat";
import { requireCustomerPage } from "@/lib/session";

export const metadata: Metadata = { title: "Support chat | AI Customer Support" };

export default async function ChatPage() {
  const user = await requireCustomerPage();

  return (
    <main className="flex flex-1 items-center justify-center bg-gray-100 p-4">
      <CustomerChat customerName={user.name} />
    </main>
  );
}
