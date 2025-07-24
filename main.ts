import { launch } from "jsr:@astral/astral";

export function add(a: number, b: number): number {
  return a + b;
}

if (import.meta.main) {
  /**
   * Performance information will be sent to the console.
   */
  const startTime = performance.now();
  const browser = await launch();
  const page = await browser.newPage();

  /**
   * This is a wrapper around page.screenshot() which handles some errors.
   *
   * I'm  still looking at the best way to handle the errors.
   * The details inside this function are still changing.
   * @returns A PNG file, or `undefined` in case of failure.
   * @throws nothing.
   * This will catch any downstream errors,
   * retry a finite number of times,
   * and ultimately report `undefined` if we can't fix the problem.
   */
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

  /**
   * This creates the *.mp4 file.
   *
   * This is static for simplicity.
   * Each time you run this program it will create at most one of these files.
   */
  class FfmpegProcess {
    static #writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
    /**
     * The writer will be created on the first use of this property, and reused as necessary.
     */
    static get writer() {
      if (!this.#writer) {
        const fileName = makeVideoFileName();
        console.log(fileName);
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
          "-preset",
          "slow",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv444p10le",
          "-colorspace",
          "bt709",
          "-color_primaries",
          "bt709",
          "-color_trc",
          "bt709",
          "-color_range",
          "pc",
          "-metadata:s:v:0",
          "color_space=display-p3",
          "-r",
          FRAMES_PER_SECOND.toString(),
          fileName.replace(".mov", ".mp4"),
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
    /**
     * If you don't call this, the resulting file is typically unreadable.
     */
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
  const initScreenCapture = (
    script: unknown
  ): {
    source: string;
    devicePixelRatio: number;
    firstFrame?: number;
    lastFrame?: number;
    seconds?: number;
  } => {
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

  const makeScreenshotFileName = () => `output/${Date.now()}.png`;
  const makeVideoFileName = () => `output/${Date.now()}.mp4`;

  const processUrl = async (request: {
    url: string;
    expectedSource?: string;
    seconds?: number;
    frames?: readonly number[];
    script?: unknown;
    slurpAll?: boolean;
    slurpStartAt?: number;
  }) => {
    async function initializeUrl(reason = "retry") {
      await page.goto(request.url);
      const fromRemote = await page.evaluate(
        (script) => initScreenCapture(script),
        { args: [request.script] }
      );
      console.log(reason, request.url, fromRemote);
      return fromRemote;
    }
    const fromRemote = await initializeUrl("processUrl");
    if (
      request.expectedSource !== undefined &&
      request.expectedSource != fromRemote.source
    ) {
      console.log(request);
      throw new Error("wrong source");
    }
    if (request.slurpAll) {
      const { firstFrame, lastFrame, seconds } = fromRemote;
      if (typeof seconds === "number") {
        // I'm not sure about round-off error and the like.
        // It seems like 10 segments of 1 second each should produce the exact same number
        // of frames as a single segment that is 10 seconds long.
        // I'm avoiding for the moment because it's complicated.
        // Time might not be an integer number of seconds or frames!!!
        const lastFrameNumber = seconds * FRAMES_PER_SECOND - 1;
        for (
          let frameNumber = request.slurpStartAt ?? 0;
          frameNumber < lastFrameNumber;
          frameNumber++
        ) {
          const timeInSeconds = frameNumber / FRAMES_PER_SECOND;
          page.evaluate((t) => showFrame(t), {
            args: [timeInSeconds],
          });
          let screenshot = await getScreenshot();
          if (!screenshot) {
            // TODO test this code!
            // I haven't been able to make the program fail yet.
            // I was hoping it would fail on it's own, and then I tried some simple things to break it.
            // I suspect this will help, but I have no idea what the problem is so I can't be sure.
            // TODO copy this to other places if it works.
            // This code is a mess and I'm not sure how to clean it up,
            // so I don't want to think about copying anything until I'm sure this works.
            await initializeUrl();
            page.evaluate((t) => showFrame(t), {
              args: [timeInSeconds],
            });
            screenshot = await getScreenshot();
            if (!screenshot) {
              console.error(
                `Aborting.  Unable to render frame ${frameNumber}. timeInSeconds=${timeInSeconds}`
              );
              break;
            }
          }
          await FfmpegProcess.writer.write(screenshot);
          if (frameNumber % 120 == 0) {
            console.log(
              `${frameNumber} of ${lastFrameNumber} frames, ${timeInSeconds} of ${seconds} seconds, ${(
                (frameNumber / lastFrameNumber) *
                100
              ).toFixed(3)}% at ${new Date().toLocaleTimeString()}`
            );
          }
        }
      } else {
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
    }
    if (request.seconds !== undefined) {
      const frameCount = request.seconds * FRAMES_PER_SECOND;
      for (let i = 0; i < frameCount; i++) {
        page.evaluate((t) => showFrame(t), {
          args: [i / (frameCount - 1)],
        });
        const screenshot = await page.screenshot();
        await FfmpegProcess.writer.write(screenshot);
        if (i % 107 == 103) {
          console.log(
            `${i} of ${frameCount}, ${((i / frameCount) * 100).toFixed(
              3
            )}% at ${new Date().toLocaleTimeString()}`
          );
        }
      }
    }
    if (request.frames) {
      for (const t of request.frames) {
        page.evaluate((t) => showFrame(t), { args: [t] });
        const fileName = makeScreenshotFileName();
        console.log(fileName);
        const screenshot = await page.screenshot();
        promises.push(Deno.writeFile(fileName, screenshot));
      }
    }
  };

  // MARK: Business Logic

  const which: string = "pentagrams";

  switch (which) {
    case "pentagrams": {
      // random-svg-tests
      await processUrl({
        url: "http://localhost:5173/fourier-smackdown.html",
        slurpAll: true,
        expectedSource: "fourier-smackdown.ts",
        //frames: [1000, (61 / 60) * 1000],
      });

      break;
    }
    case "path-to-fourier": {
      // random-svg-tests
      await processUrl({
        url: `http://localhost:5173/path-to-fourier.html?script_name=${Deno.args[0]}`,
        slurpAll: true,
        //slurpStartAt: 5811,
        expectedSource: "path-to-fourier.ts",
      });
      break;
    }
    case "some4": {
      // https://youtu.be/ubVFzZNEphs
      // https://github.com/TradeIdeasPhilip/random-svg-tests/blob/master/src/some4.ts
      await processUrl({
        url: "http://localhost:5173/some4.html",
        // Also see parts 1-5!
        script: "part 6",
        slurpAll: true,
        expectedSource: "some4.ts",
      });
      break;
    }
    case "dx demo": {
      // https://www.youtube.com/watch?v=THZZlEpo684 A quick overview of dx — Calculus class & real world perspectives.
      // https://www.youtube.com/watch?v=uRtn72SrE10 Low res preview
      await processUrl({
        url: "http://localhost:5173/dx.html",
        script: "demo",
        slurpAll: true,
        expectedSource: "dx.ts",
        //slurpStartAt: 14934,
        //   frames:[240]
      });
      break;
    }
    case "better derivative": {
      // random-svg-tests
      await processUrl({
        url: "http://localhost:5173/estimate-tangent-line.html",
        expectedSource: "estimate-tangent-line.ts",
        //seconds: 8.5,
        script: "introduction",
      });
      await processUrl({
        url: "http://localhost:5173/text-for-derivative.html",
        //slurpAll: true,
      });
      await processUrl({
        url: "http://localhost:5173/parabola-tangent-line.html",
        //slurpAll: true,
        //frames:[0],
      });
      await processUrl({
        // https://www.youtube.com/watch?v=0pZ10xOPHL4 Parabolas vs Line Segments & Better Morphing
        url: "http://localhost:5173/tangent-line-2.html",
        // seconds: 27,
      });
      await processUrl({
        url: "http://localhost:5173/dx.html",
        script: "main",
        slurpAll: true,
        expectedSource: "dx.ts",
      });
      break;
    }
    case "bug splat": {
      // https://www.youtube.com/watch?v=BgSACVlGmbg  #SVG bug splat effect using feTurbulence and feDisplacementMap
      // random-svg-tests
      await processUrl({
        url: "http://localhost:5173/bug-splat.html",
        seconds: 47 + 38 / 60,
        frames: [0, 0.25, 0.5, 0.75],
      });
      break;
    }
    case "tangent thing": {
      // https://www.youtube.com/watch?v=ozvehaKqUFk  Simple Numerical Differentiation & Finite Differences
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
      // https://www.youtube.com/watch?v=LQeiRXg8zGk  Homage to This open problem taught me what topology is #3blue1brown
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
