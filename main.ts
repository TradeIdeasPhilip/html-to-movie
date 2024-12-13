import { launch } from "jsr:@astral/astral";

export function add(a: number, b: number): number {
  return a + b;
}

const FRAME_COUNT = 100;
function format(n: number) {
  return n.toString().padStart(3, "0");
}

if (import.meta.main) {
  const startTime = performance.now();
  const browser = await launch();
  const page = await browser.newPage(
    "http://localhost:5173/estimate-tangent-line.html"
  );
  page.setViewportSize({ width: 1920, height: 1080 });

  const fromRemote = await page.evaluate(() =>
    (window as any).initScreenCapture()
  );
  console.log(fromRemote);

  const ffmpegProcess = new Deno.Command("./ffmpeg", {
    args: "-loglevel warning -framerate 60 -f image2pipe -i - -c:v libx264 -r 60 -pix_fmt yuv420p output/output.mp4".split(
      " "
    ),
    stdin: "piped",
  }).spawn();
  const writer = ffmpegProcess.stdin.getWriter();

  const promises: Promise<void>[] = [];

  for (let i = 0; i < FRAME_COUNT; i++) {
    page.evaluate((t) => (window as any).showFrame(t), {
      args: [i / (FRAME_COUNT - 1)],
    });
    const screenshot = await page.screenshot();
    await writer.write(screenshot);
    //promises.push(Deno.writeFile(`screenshot${format(i)}.png`, screenshot));
  }

  console.log(
    `Waiting for writes after ${
      (performance.now() - startTime) / 1000
    } seconds.`
  );

  await Promise.all(promises);
  await writer.close();
  //await ffmpegProcess.stdin.close();
  ffmpegProcess.ref();
  await browser.close();

  const endTime = performance.now();
  console.log(
    `${FRAME_COUNT} frames in ${(endTime - startTime) / 1000} seconds.  (${
      (endTime - startTime) / 1000 / FRAME_COUNT
    } seconds/frame)`
  );
}

// cat *.png | ../ffmpeg -loglevel warning -framerate 60 -f image2pipe -i - -c:v libx264 -r 60 -pix_fmt yuv420p output.mp4
