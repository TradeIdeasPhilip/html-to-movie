# HTML to Movie

This is an application that lets me create an animation in HTML (with SVG, CSS, TypeScript and all you other favorite web tools) and record it as a video.

I am much more comfortable with HTML tools than any of the movie making tools I've tried.
So I made my own tool.
I can create a web style animation and use this tool to convert it into a movie.

The content does **not** need to run in real time.
The recorder will wait as little or long as needed to save each frame.

The content does **not** need to display on your screen while you're recording it.
By default the content displays on a window that is never displayed.
The window can be any size you want, even bigger than your physical screen.
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
  - Make no assumptions about the order in which the frames will be requested.

The content can be hosted anywhere.
I'm typically running the content locally using Vite and VS Code, so I can modify it as I go.

I recommend using the JavaScript Animation API, rather than putting `@keyframes` into a CSS file.
I recommend this in almost all cases, but especially here.
This project explicitly avoids any realtime work, and pure CSS animations always use the realtime clock.
In the API you can initially set the animation's duration to `1` and `pause()` it.
Then you can copy the value of `t` directly into `animation.currentTime`.

### Rendering Your Content

Once your content is up, run this program to record it.
There is no user interface, yet.
You have to change [./main.ts](./main.ts).
Search for `MARK: Business Logic` and replace that with your own script.
Search for `MARK: Configurable Stuff` for optional settings.
Then run the following:

```
deno run --allow-all ./main.ts
```

The output all goes to the `output/` directory.
Depending on your business logic you can get 0 or 1 \*.mp4 files and 0 or more \*.png files.
I use an increasing number for the file name, so repeated runs will not overwrite previous results.

## This is a work in progress!

It's working, but very rough.
I'm just starting to use it for real and I'm finding the missing features.

There is a lot of room for performance tuning.
There are a lot of obvious things to do, but the details keep changing.
I'll optimize when I understand the problem better.

When I cut the resolution by 4x (in each dimension) I got the result in about ⅒ the time.
That works well for a temporary file.
I can use the low quality print to make sure I have the timing perfect and the other features at least close.
