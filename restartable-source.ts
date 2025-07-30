// TODO I might have been inconsistent below.
// std error should be the control channel and std out should be the data channel.


export class RestartableSource {
  readonly #commandLineArgs: readonly string[];
  /**
   * This does nothing but save a copy of the input.
   * Opening the process will be deferred until the first time we need it.
   * @param commandLineArgs To start the process.
   */
  constructor(
    commandLineArgs: readonly string[],
    readonly pipeStdOutTo: some_appropriate_stream_class
  ) {
    this.#commandLineArgs = [...commandLineArgs];
  }
  /**
   * @throws Maybe the process doesn't exist or something like that.
   * We don't expect any trouble in normal operations, but you should wrap this in a try/catch.
   */
  async #startIfRequired() {
    // if it's already running, return immediately.
    // If there's already a closed process, throw that away.
    // Create
  }
  /**
   * Try to read a string from the process's standard input.
   *
   * This is **not** responsible for starting or restarting the process.
   * If the process has already exited, throw an Error.
   * If the process has never been started, throw an Error.
   * If we run into an unexpected exception, let it pass through because the caller will already have a try/catch.
   * @returns A line of text from the process.  On any errors this will return undefined.
   * @throws This can throw for a number of reasons.
   */
  async #getLine(): Promise<string > {
      // TODO!
      return "placeholder / TODO"
  }
  /**
   * 
   * @param request A string to send to the subprocess.
   * @returns The status of the request.
   * @throws Any unexpected errors get thrown.  
   * The main program will probably want to catch these and start a graceful shutdown.
   */
  async #makeRequestOnce(request: string) : Promise<"success"|"please try again"> {
      await this.#startIfRequired();
      // TODO write the string to the sub process, add the \n, and flush(), like you'e been doing
      const line = await this.#getLine();
    if (line === "success" || line ==="please try again") {
      return line;
    }
    console.warn('Unexpected response:', line);
    // Might as well shut down here.  
    // The sub process broke the contract so we'll assume something serious is wrong.
    // The caller already needs a try / catch, and this is just more of the same.
    throw new Error("Unexpected response.")
  }
  /**
   * Use this to make sure we've drained all output from the subprocess's standard output and standard error.
   * If the process is already done, or has never started, this will resolve immediately.
   * 
   * This will not kill the process or ask the process to kill itself.
   * This only waits.
   * This might be called at the end of our main program before we print one final message to the log and exit.
   * Or it might be called internally to help with retries.
   * A subprocess might report "please try again" on the stdout / control channel, while valid data is still queued up in the stderr / image data channel.
   */
  async waitForDone() {
    // TODO
  }
  /**
   * Send a request to the subprocess.
   * 
   * Wait for a confirmation from the sub process before resolving.
   * 
   * Automatically handle retries when the subprocess requests them correctly.
   * 
   * This is the only (public) method that can create a subprocess.
   * 
   * The payload of the response will be sent directly to the standard error channel.
   * @param request A string to send to the subprocess.
   * Probably something simple, like a frame number or a time, but it's opaque to this class.
   * @param currentStatus Something to display on the log in case of retry.
   * @returns A promise that resolves after the request has been confirmed.
   * @throws The promise can reject for any number of reasons so you should .catch() or await and try/catch.
   * These are unexpected errors.
   * This function only retries in very specific (but common and important) cases.
   */
  async makeRequest(request: string, currentStatus:unknown = request) {
    while (true) {
      const response = await this.#makeRequestOnce(request);
      if (response !== "please try again") {
        return;
      }
      console.info("Automatic retry @ ", currentStatus);
    }
  }
  /**
   * Send a request to the subprocess end to do a graceful close.
   * 
   * Note that this program never kills the subprocess.
   * It can make graceful requests.
   * And it can wait for the death of the subprocess, graceful or otherwise.
   * 
   * If the subprocess has already exited or has never started, do nothing.
   * 
   * @returns Nothing.  If you want status, consider this.waitForDone().
   * @throws Nothing.  This is simple safe to call in a number of places, perhaps you're already in a catch block and you are cleaning up and you don't want to check for even more errors.
   */
  close() {
    // TODO close the subprocess's standard input.
    // The subprocess will accept that as a graceful request to shut down.
    // It will await any processing and output in progress, then it will exit.
    // Rationale:  Like ctrl-D in Unix to end a lot of things.
    // In fact, this sub process doesn't even need a complicated main program like this, it could exist on its own, perhaps for testing, and I could type numbers at the console to control it.
  }
}
