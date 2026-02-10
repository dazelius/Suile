import { Breadcrumb } from "@/components/layout/Breadcrumb";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumb />
      {children}
    </div>
  );
}
