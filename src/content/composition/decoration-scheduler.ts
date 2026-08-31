export interface DecorationTask {
  name: string;
  run(): void;
}

export interface DecorationScheduler {
  destroy(): void;
  runNow(): void;
  schedule(): void;
}

export function createDecorationScheduler(
  tasks: readonly DecorationTask[],
  requestFrame: (callback: FrameRequestCallback) => number =
    requestAnimationFrame,
  cancelFrame: (handle: number) => void =
    typeof cancelAnimationFrame === "function"
      ? cancelAnimationFrame
      : () => undefined
): DecorationScheduler {
  let scheduled = false;
  let frameHandle: number | null = null;

  function runNow(): void {
    scheduled = false;
    frameHandle = null;

    for (const task of tasks) {
      try {
        task.run();
      } catch (error) {
        console.error(
          `[POE Trade Helper] Decoration task failed: ${task.name}`,
          error
        );
      }
    }
  }

  function schedule(): void {
    if (scheduled) {
      return;
    }

    scheduled = true;
    frameHandle = requestFrame(runNow);
  }

  function destroy(): void {
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    scheduled = false;
  }

  return { destroy, runNow, schedule };
}
