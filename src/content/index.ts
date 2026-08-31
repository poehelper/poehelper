import { createContentApp, type ContentApp } from "./composition/app";
import { getLegacyDependencies } from "./composition/legacy-dependencies";

const RUNTIME_KEY = "__poeTradeStylerRuntime";

function getCurrentRuntime(): ContentApp | null {
  return (Reflect.get(globalThis, RUNTIME_KEY) as ContentApp | undefined) ?? null;
}

if (!getCurrentRuntime()) {
  Reflect.set(globalThis, RUNTIME_KEY, createContentApp(getLegacyDependencies()));
}
