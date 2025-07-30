const makeVideoFileName = (extension: "mp4" | "mov", filenamePrefix = "") =>
  `output/${filenamePrefix}${Date.now()}.${extension}`;

/**
 * This creates the *.mp4 file.
 */
export class FfmpegProcess {
  /**
   * FFmpeg settings for H.264 in MP4 container, optimized for YouTube uploads.
   * @remarks
   * - **Quality**: 10-bit `yuv444p10le` and `-crf 14` preserve darker gradients, matching ProRes 422 quality on YouTube after VP9 re-encoding (\~8.8 Mbps).
   * - **File Size**: \~100–200MB/minute, ideal for 8-minute tests (\~0.8–1.6GB).
   * - **Crash Tolerance**: `-movflags frag_keyframe+empty_moov` ensures partial MP4s are playable on Ctrl+C or crashes.
   * - **Speed**: `-preset medium` (\~4–5 frames/s, \~96–120 minutes for 8 minutes) is slower than ProRes but fast enough for workflows.
   * - **YouTube**: `-movflags faststart` optimizes for quick processing and playback.
   */
  static h264Args(
    options: { framesPerSecond?: number; filenamePrefix?: string } = {}
  ) {
    options.framesPerSecond ??= 60;
    options.filenamePrefix ??= "";
    return [
      "-loglevel",
      "warning",
      "-framerate",
      options.framesPerSecond.toString(),
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
      options.framesPerSecond.toString(),
      makeVideoFileName("mp4", options.filenamePrefix),
    ];
  }
  /**
   * FFmpeg settings for ProRes 422 in MOV container, optimized for CapCut editing.
   * @remarks
   * - **Quality**: 10-bit `yuv444p10le` and `-profile:v 1` preserve darker gradients (0.08–0.35 multiplier), ideal for editing.
   * - **File Size**: \~3–5GB/minute, suitable for 8-minute tests (\~24–40GB).
   * - **Crash Tolerance**: Intra-frame encoding ensures partial MOVs are playable on Ctrl+C or crashes.
   * - **Speed**: \~6–10 frames/s (\~48–80 minutes for 8 minutes on M2 MacBook Air).
   * - **Use Case**: Essential for heavy editing (e.g., color grading, effects in CapCut) or if YouTube’s compression degrades quality in future projects. Use as a backup for such cases.
   */
  static proresSmallerArgs(
    options: {
      framesPerSecond?: number;
      filenamePrefix?: string;
      filesize?: "big" | "small";
    } = {}
  ) {
    options.framesPerSecond ??= 60;
    options.filenamePrefix ??= "";
    options.filesize ??= "small";
    //  // Set to 1 for ProRes 422 (lower bitrate than 422 HQ)  Set to 3 to get ProRes 422 HQ, ~10gig/minute
    const level = options.filesize === "big" ? "3" : "1";
    return [
      "-loglevel",
      "warning",
      "-framerate",
      options.framesPerSecond.toString(),
      "-f",
      "image2pipe",
      "-i",
      "-",
      "-c:v",
      "prores_ks",
      "-profile:v",
      level,
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
      options.framesPerSecond.toString(),
      makeVideoFileName("mov", options.filenamePrefix),
    ];
  }
  #writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  readonly #argsForSpawn: string[];
  /**
   * The writer will be created on the first use of this property, and reused as necessary.
   */
  get writer() {
    if (!this.#writer) {
      const ffmpegProcess = new Deno.Command("./ffmpeg", {
        args: this.#argsForSpawn,
        stdin: "piped",
      }).spawn();
      ffmpegProcess.ref();
      this.#writer = ffmpegProcess.stdin.getWriter();
    }
    return this.#writer;
  }
  /**
   * If you don't call this, the resulting file is typically unreadable.
   * (Hopefully I've fixed that by using a different file format.  But call this to be sure.)
   */
  async close() {
    try {
      await this.#writer?.close();
    } catch (reason) {
      // I really don't want to deal with an error here.
      // Honestly, the only error handler I care about is closing this process.
      // If that fails, nothing else really matters.
      console.error(reason);
    }
  }
  constructor(args = FfmpegProcess.h264Args()) {
    this.#argsForSpawn = args;
  }
  #registerCleanup() {
    addEventListener("unhandledrejection", (event) => {
      this.close();
      console.warn(`Unhandled promise rejection: ${event.reason}`);
    });
    // Handle termination signals (SIGINT, SIGTERM)
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      Deno.addSignalListener(signal, () => {
        this.close();
        console.warn(signal);
      });
    }
    // Handle normal process exit via unload event
    addEventListener("unload", () => {
      this.close();
    });
  }
}
