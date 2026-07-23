import React from "react";
import { createRoot } from "react-dom/client";

import { StructuredPracticeDemo } from "@/features/structured-practice/StructuredPracticeDemo";

import "./styles.css";

function PublicDemoApp() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-semibold">结构化表达训练场</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            免费公开训练
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <StructuredPracticeDemo />
      </div>
      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-sm text-slate-500">
        本页仅在浏览器中运行确定性规则，不调用数据库或外部 AI 模型。
      </footer>
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("无法找到公开演示挂载节点。");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <PublicDemoApp />
  </React.StrictMode>
);
