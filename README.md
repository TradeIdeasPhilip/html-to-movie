# HTML to Movie

This is an application that lets me create an animation in HTML (with SVG, CSS, TypeScript and all you other favorite web tools) and record it as a video.

I am much more comfortable with HTML tools than any of the movie making tools I've tried.
So I made my own tool.
I can create a web style animation and use this tool to convert it into a movie.

The content does **not** need to run in real time.
The recorder will wait as little or long as needed to save each frame.

The content does **not** need to display on your screen while you're recording it.
By default the content displays on a window that is never displayed.
The window can be any size I want, even bigger than your physical screen.
So you can make high quality, high resolution videos on any computer.

This only creates video, not audio.

## How to Use

I'm running this on a Mac.
I haven't tried it anywhere else.

### One Time Setup

Download the ffmpeg executable and put it into the root directory of this project.
Install Deno on your machine.

### Creating Your Content

You create one or more HTML files, more or less like normal.
Then you add two additional methods to the window object.

- `initScreenCapture() : unknown` is called after the page loads, before any screenshots are taken.
  - Currently there are no inputs but this would be a good way to send configuration information.
  - The output from this function is logged in the Deno process's console.
  - This typically hides a debug interface from the screen.
- `showFrame(t : number) : void` is called before each screenshot.
  - The input should be a number between 0 and 1, inclusive.
  - The content doesn't know how long it will run for or the frame rate.

The content can be hosted anywhere.
I'm typically running the content locally using Vite and VS Code, so I can modify it as I go.

### Rendering Your Content

Once your content is up, run this program to record it.
There is no user interface, yet.
You have to change [./main.ts](./main.ts).
At a bare minimum configure the following:

- `FRAME_COUNT`
- `page.setViewportSize()`
- and the URL in `browser.newPage()`

Then run the following:

```
deno --allow-all run ./main.ts
```

The output is currently hardcoded to `output/output.mp4`.

## This is a work in progress!

It's working, but very rough.
There is a lot of room for performance tuning.
