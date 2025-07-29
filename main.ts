import { launch } from "jsr:@astral/astral@0.5.0";

// TODO:  https://pptr.dev/api/puppeteer.page.emulatemediafeatures
// We can control a lot of things.
// We can change this environment to look more like my normal browser, i.e. the test environment.
// We can change the zoom (possibly a nearby API) so it's 1× and simple.

if (import.meta.main) {
  /**
   * Performance information will be sent to the console.
   */
  const startTime = performance.now();
  const browser = await launch();

  // MARK: Configurable Stuff

  // Note:  This is the size in CSS pixels, not device pixels.
  // You will get twice as many pixels (in each dimension) as you request here.
  const widthInCssPixels = 1920;
  const heightInCssPixels = 1080;
  const FRAMES_PER_SECOND = 60;

  // MARK: Configuration Ends

  const createPage = async () => {
    const newPage = await browser.newPage();
    await newPage.setViewportSize({
      width: widthInCssPixels,
      height: heightInCssPixels,
    });
    return newPage;
  };
  const page = await createPage();

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
        /**
         * FFmpeg settings for ProRes 422 in MOV container, optimized for CapCut editing.
         * @remarks
         * - **Quality**: 10-bit `yuv444p10le` and `-profile:v 1` preserve darker gradients (0.08–0.35 multiplier), ideal for editing.
         * - **File Size**: \~3–5GB/minute, suitable for 8-minute tests (\~24–40GB).
         * - **Crash Tolerance**: Intra-frame encoding ensures partial MOVs are playable on Ctrl+C or crashes.
         * - **Speed**: \~6–10 frames/s (\~48–80 minutes for 8 minutes on M2 MacBook Air).
         * - **Use Case**: Essential for heavy editing (e.g., color grading, effects in CapCut) or if YouTube’s compression degrades quality in future projects. Use as a backup for such cases.
         */
        const _prores_smaller_args = [
          "-loglevel",
          "warning",
          "-framerate",
          FRAMES_PER_SECOND.toString(),
          "-f",
          "image2pipe",
          "-i",
          "-",
          "-c:v",
          "prores_ks",
          "-profile:v",
          "1", // ProRes 422 (lower bitrate than 422 HQ)  Set to 3 to get ProRes 422 HQ, ~10gig/minute
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
          makeVideoFileName("mov"),
        ];
        /**
         * FFmpeg settings for H.264 in MP4 container, optimized for YouTube uploads.
         * @remarks
         * - **Quality**: 10-bit `yuv444p10le` and `-crf 14` preserve darker gradients, matching ProRes 422 quality on YouTube after VP9 re-encoding (\~8.8 Mbps).
         * - **File Size**: \~100–200MB/minute, ideal for 8-minute tests (\~0.8–1.6GB).
         * - **Crash Tolerance**: `-movflags frag_keyframe+empty_moov` ensures partial MP4s are playable on Ctrl+C or crashes.
         * - **Speed**: `-preset medium` (\~4–5 frames/s, \~96–120 minutes for 8 minutes) is slower than ProRes but fast enough for workflows.
         * - **YouTube**: `-movflags faststart` optimizes for quick processing and playback.
         */
        const _youtube_args = [
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
          "medium",
          "-crf",
          "14",
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
          "-movflags",
          "frag_keyframe+empty_moov+faststart", // Crash-tolerant, CapCut-ready
          "-r",
          FRAMES_PER_SECOND.toString(),
          makeVideoFileName("mp4"),
        ];
        const args = _youtube_args;
        console.log(args);
        const ffmpegProcess = new Deno.Command("./ffmpeg", {
          args,
          stdin: "piped",
        }).spawn();
        ffmpegProcess.ref();
        this.#writer = ffmpegProcess.stdin.getWriter();
      }
      // This is a simple wrapper around this.#writer.write().
      // Mostly I added this layer because this.#writer.write() would accept undefined as an input.
      // I'm reserving undefined for error conditions, and I want TypeScript to help me catch these.
      // And this hides more details about the #writer object that we just don't need to share.
      return {
        write: (chuck: Uint8Array<ArrayBufferLike>) =>
          this.#writer!.write(chuck),
      };
    }
    /**
     * If you don't call this, the resulting file is typically unreadable.
     * (Hopefully I've fixed that by using a different file format.  But call this to be sure.)
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
  let filenamePrefix = "";
  const makeVideoFileName = (extension: "mp4" | "mov") =>
    `output/${filenamePrefix}${Date.now()}.${extension}`;

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
      if (puppeteerHasAlreadyFailed) {
        console.warn(
          "Ignoring initializeUrl() request because puppeteerHasAlreadyFailed."
        );
        return undefined;
      }
      await page.goto(request.url);
      const fromRemote = await page.evaluate(
        (script) => initScreenCapture(script),
        { args: [request.script] }
      );
      console.log(reason, request.url, fromRemote);
      return fromRemote;
    }
    let puppeteerHasAlreadyFailed = false;
    /**
     * Ask the browser to show a specific frame, then take a screenshot of that frame.
     *
     * In case of error this sends status to the console then returns `undefined`.
     * Upon receiving this, it's best to do an orderly shutdown.
     * I've tried reconnecting to Puppeteer, but that never works.
     * I just hang forever.
     * It's better to restart the program after a graceful shutdown.
     * @param t Ask the web page to display this frame.
     * The exact meaning of t depends on the web software.
     * Older software always fixed the range as 0 - 1.
     * "slurp," the newest option, uses this as a frame number.  (I think.)
     * Future plans will probably include a time in seconds or milliseconds,
     * so the Deno side will control the frame rate.
     * @returns A PNG file in a format appropriate for `FfmpegProcess.writer.write()`.
     * Or `undefined` on failure.
     * @throws This never throws anything.  Errors are returned as `undefined`.
     */
    async function screenshotAt(t: number) {
      if (puppeteerHasAlreadyFailed) {
        return undefined;
      }
      try {
        await page.evaluate((t) => showFrame(t), {
          args: [t],
        });
        const screenshot = await page.screenshot({ optimizeForSpeed: true });
        return screenshot;
      } catch (reason: unknown) {
        puppeteerHasAlreadyFailed = true;
        console.warn(
          "Giving up, failure at t=",
          t,
          new Date().toLocaleTimeString(),
          reason
        );
        return undefined;
      }
    }
    // TODO that ! below is very ugly.  All of the error handling is currently a mess.
    // The ! is right because I know that complicated circumstances will make it true.
    const fromRemote = (await initializeUrl("processUrl"))!;
    if (
      request.expectedSource !== undefined &&
      request.expectedSource != fromRemote.source
    ) {
      console.log(request);
      throw new Error("wrong source");
    }
    if (request.frames) {
      for (const t of request.frames) {
        const fileName = makeScreenshotFileName();
        console.log(fileName);
        const screenshot = await screenshotAt(t);
        if (!screenshot) {
          console.warn("Aborting durning individual frames phase.");
          break;
        }
        promises.push(Deno.writeFile(fileName, screenshot));
      }
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
          const screenshot = await screenshotAt(timeInSeconds);
          if (!screenshot) {
            console.error(
              `Aborting.  Unable to render frame ${frameNumber}. timeInSeconds=${timeInSeconds}`
            );
            console.log(
              `Consider slurpStartAt: ${timeInSeconds} when retrying.`
            );
            break;
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
          const screenshot = await screenshotAt(frameNumber);
          if (!screenshot) {
            console.error(`Aborting.  Unable to render frame ${frameNumber}`);
            console.log(`Consider slurpStartAt: ${frameNumber} when retrying.`);
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
        const screenshot = await screenshotAt(i / (frameCount - 1));
        if (!screenshot) {
          console.warn("Bailing out at at i=", i);
          break;
        }
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
  };

  // MARK: Business Logic

  const which: string = "pentagrams";

  switch (which) {
    case "pentagrams": {
      // random-svg-tests
      const index = Deno.args[0];
      let slurpStartAt: number | undefined;
      if (Deno.args.length >= 2) {
        slurpStartAt = +Deno.args[1];
        if (!isFinite(slurpStartAt)) {
          console.error("invalid slurpStartAt", Deno.args[1]);
        }
      }
      filenamePrefix = `pentagram${index.padStart(2, "0")}-`;
      await processUrl({
        url: `http://localhost:5173/fourier-smackdown.html?index=${index}`,
        slurpAll: true,
        slurpStartAt,
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
    } seconds.`,
    new Date().toLocaleTimeString()
  );

  promises.push(FfmpegProcess.close() /*, browser.close()*/);
  await Promise.all(promises);

  const endTime = performance.now();
  console.log(
    `${(endTime - startTime) / 1000} seconds.`,
    new Date().toLocaleTimeString()
  );

  // browser.close() hangs sometimes.
  // If I don't call it explicitly, i still hang sometimes.
  // presumably it's being called in the normal shutdown sequence
  Deno.exit(0);
}
