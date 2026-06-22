// app/reset/page.tsx
import { Suspense } from "react";
import ResetClient from "./reset-client";
import { LoadingCat } from "@/components/LoadingCat";

export const dynamic = "force-dynamic"; // プリレンダー回避（重要）

export default function ResetPage() {
  return (
    <Suspense fallback={<LoadingCat />}>
      <ResetClient />
    </Suspense>
  );
}