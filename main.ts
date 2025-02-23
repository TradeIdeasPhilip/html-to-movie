import { launch } from "jsr:@astral/astral";

export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Asserts these very common bounds on the input.
 * Many processes, especially animations and pieces of animations, accept 0 for the beginning, 1 for the end, and any number you want in between.
 *
 * This same assertion exists a lot in the remote code that we are running.
 * It would be nice to catch any errors here, sooner, closer to the source of the error.
 * @param t A value between 0 and 1.
 */
function assertValidT(t: number) {
  if (!(isFinite(t) && t >= 0 && t <= 1)) {
    throw new Error(`t should be between 0 and 1, inclusive. t == ${t}`);
  }
}

if (import.meta.main) {
  const startTime = performance.now();
  const browser = await launch();
  const page = await browser.newPage();

  const getScreenshot = async () => {
    try {
      const screenshot = await page.screenshot({ optimizeForSpeed: true });
      return screenshot;
    } catch (reason) {
      console.warn("Retrying", reason);
      try {
        const screenshot = await page.screenshot({ optimizeForSpeed: true });
        return screenshot;
      } catch (reason) {
        console.error("Failed", reason);
        return undefined;
      }
    }
    // This is the error I was seeing sometimes.
    /*
          error: Uncaught (in promise) RetryError: Retrying exceeded the maxAttempts (5).
              throw new RetryError(error, maxAttempts);
                    ^
          at retry (https://jsr.io/@std/async/1.0.9/retry.ts:154:15)
          at eventLoopTick (ext:core/01_core.js:216:9)
          at async Page.screenshot (https://jsr.io/@astral/astral/0.4.9/src/page.ts:626:22)
          at async processUrl (file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:132:28)
          at async file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:172:7
      Caused by: TimeoutError: Signal timed out.
          at ext:deno_web/03_abort_signal.js:130:11
          at eventLoopTick (ext:core/01_core.js:212:13)
    */
    // This is what I saw after adding this event handler.
    /*
        Retrying RetryError: Retrying exceeded the maxAttempts (5).
          at retry (https://jsr.io/@std/async/1.0.9/retry.ts:154:15)
          at eventLoopTick (ext:core/01_core.js:216:9)
          at async Page.screenshot (https://jsr.io/@astral/astral/0.4.9/src/page.ts:626:22)
          at async getScreenshot (file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:28:26)
          at async processUrl (file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:148:28)
          at async file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:192:7
      Caused by TimeoutError: Signal timed out.
          at ext:deno_web/03_abort_signal.js:130:11
          at eventLoopTick (ext:core/01_core.js:212:13) {
        name: "RetryError"
      }
      Failed RetryError: Retrying exceeded the maxAttempts (5).
          at retry (https://jsr.io/@std/async/1.0.9/retry.ts:154:15)
          at eventLoopTick (ext:core/01_core.js:216:9)
          at async Page.screenshot (https://jsr.io/@astral/astral/0.4.9/src/page.ts:626:22)
          at async getScreenshot (file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:33:28)
          at async processUrl (file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:148:28)
          at async file:///Users/philipsmolen/Documents/fun-git/html-to-movie/main.ts:192:7
      Caused by TimeoutError: Signal timed out.
          at ext:deno_web/03_abort_signal.js:130:11
          at eventLoopTick (ext:core/01_core.js:212:13) {
        name: "RetryError"
      }
      Aborting.  Unable to render frame 14934
      Waiting for writes after 2179.2570044159997 seconds.
      2179.4041388329997 seconds.
   */
    // It appears that the browser gets into some strange state.
    // Repeating the operation doesn't help.
    // I did manage to write out a useable mp4 file, so I don't have to restart from scratch.
    // TODO Try closing and restarting the browser, then retrying.
  };

  // MARK: Configurable Stuff

  // Note:  This is the size in CSS pixels, not device pixels.
  // You will get twice as many pixels (in each dimension) as you request here.
  await page.setViewportSize({ width: 1920, height: 1080 });
  //await page.setViewportSize({ width: 480, height: 270 });
  const FRAMES_PER_SECOND = 60;

  // MARK: Configuration Ends

  class FfmpegProcess {
    static #writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
    static get writer() {
      if (!this.#writer) {
        // I copied most of this from https://shotstack.io/learn/use-ffmpeg-to-convert-images-to-video/
        const args = [
          "-loglevel",
          "warning",
          "-framerate",
          FRAMES_PER_SECOND.toString(),
          "-f",
          "image2pipe",
          "-i",
          "-",
          "-c:v",
          "libx264",
          "-r",
          FRAMES_PER_SECOND.toString(),
          "-pix_fmt",
          "yuv420p",
          videoName(),
        ];
        const ffmpegProcess = new Deno.Command("./ffmpeg", {
          args,
          stdin: "piped",
        }).spawn();
        ffmpegProcess.ref();
        this.#writer = ffmpegProcess.stdin.getWriter();
      }
      return this.#writer;
    }
    static async close() {
      await this.#writer?.close();
    }
  }

  const promises: Promise<void>[] = [];

  /**
   * This function exists on the remote system as a global.
   * Call this once before asking for individual frames.
   * @param script A value that is passed on to the remote system.
   * This makes it easy for one html program to implement different scenes.
   * This could be anything, depending on the remote program.
   * Currently one of my programs ignores this and the other uses a string to select from a few well know programs.
   * This value must be JSON friendly to get to the remote process in tact.
   */
  const initScreenCapture = (script: unknown) => {
    JSON.stringify(script);
    throw "wtf";
  };

  /**
   * This function exists on the remote system as a global.
   * Call this to ask it to draw a particular frame.
   * @param t A number between 0 and 1, inclusive.
   * The remote system doesn't know about seconds or frame numbers.
   * It only knows how to draw the system at a time between 0 and 1.
   */
  const showFrame = (t: number) => {
    t;
    throw "wtf";
  };

  const screenshotName = () => `output/${Date.now()}.png`;
  const videoName = () => `output/${Date.now()}.mp4`;

  const processUrl = async (request: {
    url: string;
    seconds?: number;
    frames?: readonly number[];
    script?: unknown;
    slurpAll?: boolean;
    slurpStartAt?: number;
  }) => {
    await page.goto(request.url);
    const fromRemote = await page.evaluate(
      (script) => initScreenCapture(script),
      { args: [request.script] }
    );
    console.log(fromRemote);
    if (request.slurpAll) {
      const { firstFrame, lastFrame } = fromRemote as {
        readonly firstFrame: number;
        readonly lastFrame: number;
      };
      if (typeof firstFrame !== "number" || typeof lastFrame !== "number") {
        throw new Error("wtf");
      }
      for (
        let frameNumber = request.slurpStartAt ?? firstFrame;
        frameNumber <= lastFrame;
        frameNumber++
      ) {
        page.evaluate((t) => showFrame(t), {
          args: [frameNumber],
        });
        const screenshot = await getScreenshot();
        if (!screenshot) {
          console.error(`Aborting.  Unable to render frame ${frameNumber}`);
          break;
        }
        await FfmpegProcess.writer.write(screenshot);
        if (frameNumber % 103 == 101) {
          const index = frameNumber - firstFrame;
          const total = lastFrame - firstFrame;
          console.log(
            `${index} of ${total}, ${((index / total) * 100).toFixed(
              3
            )}% at ${new Date().toLocaleTimeString()}`
          );
        }
      }
    }
    if (request.seconds !== undefined) {
      const frameCount = request.seconds * FRAMES_PER_SECOND;
      for (let i = 0; i < frameCount; i++) {
        page.evaluate((t) => showFrame(t), {
          args: [i / (frameCount - 1)],
        });
        const screenshot = await page.screenshot();
        await FfmpegProcess.writer.write(screenshot);
      }
    }
    if (request.frames) {
      for (const t of request.frames) {
        //  assertValidT(t);
        page.evaluate((t) => showFrame(t), { args: [t] });
        const screenshot = await page.screenshot();
        promises.push(Deno.writeFile(screenshotName(), screenshot));
      }
    }
  };

  // MARK: Business Logic

  const which: string = "dx demo";

  switch (which) {
    case "dx demo": {
      // dx.html
      await processUrl({
        url: "http://localhost:5173/dx.html",
        script: "demo",
        slurpAll: true,
        //slurpStartAt: 14934,
        //   frames:[240]
      });
      break;
    }
    case "better derivative": {
      // random-svg-tests
      await processUrl({
        url: "http://localhost:5173/tangent-line-2.html",
        seconds: 27,
      });
      break;
    }
    case "bug splat": {
      // random-svg-tests
      await processUrl({
        url: "http://localhost:5173/bug-splat.html",
        seconds: 47 + 38 / 60,
        frames: [0, 0.25, 0.5, 0.75],
      });
      break;
    }
    case "tangent thing": {
      await processUrl({
        url: "http://localhost:5173/estimate-tangent-line.html",
        //seconds: 6,
        script: "introduction",
      });
      await processUrl({
        url: "http://localhost:5173/show-text.html",
        //seconds: 14,
        //frames: [1],
      });
      await processUrl({
        url: "http://localhost:5173/estimate-tangent-line.html",
        //seconds: 39.43333333333333,
        script: "main",
      });
      await processUrl({
        url: "http://localhost:5173/show-text-1.html",
        seconds: 51,
      });

      break;
    }
    case "tau": {
      await processUrl({
        url: "http://localhost:5173/tau",
        seconds: 45,
        script: "main",
      });
      //480 x 270
      await page.setViewportSize({ width: 240, height: 135 });
      await processUrl({
        url: "http://localhost:5173/tau",
        frames: [1],
        script: "thumbnail",
      });
      break;
    }
    default: {
      throw new Error("wtf");
    }
  }

  // MARK: Business Logic End

  console.log(
    `Waiting for writes after ${
      (performance.now() - startTime) / 1000
    } seconds.`
  );

  promises.push(FfmpegProcess.close(), browser.close());
  await Promise.all(promises);

  const endTime = performance.now();
  console.log(`${(endTime - startTime) / 1000} seconds.`);
}
