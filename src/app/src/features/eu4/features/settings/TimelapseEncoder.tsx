import { MapPayload } from "../../types/map";
import { MapDate } from "../../types/models";
import WebMMuxer from "webm-muxer";
import { WebGLMap } from "@/map/map";
import { Eu4Worker } from "../../worker";

type DateInterval = "Year" | "Month" | "Week" | "Day";

export async function* dates(
  worker: Eu4Worker,
  start: MapDate,
  end: MapDate,
  step: DateInterval
) {
  let current = start;
  while (true) {
    yield current;
    const newDate = await worker.eu4IncrementDate(current.days, step);

    if (current.days >= end.days) {
      break;
    } else if (newDate.days > end.days) {
      current = end;
    } else {
      current = newDate;
    }
  }
}

type EncoderConfig = VideoEncoderConfig & {
  webmCodec: "V_VP8" | "V_VP9";
};

type TimelapseEncoderOptions = {
  map: WebGLMap;
  fps: number;
  interval: "Year" | "Month" | "Week" | "Day";
  worker: Eu4Worker;
  mapPayload: MapPayload;
  startDate: MapDate;
  endDate: MapDate;
  freezeFrame: number;
};

export class TimelapseEncoder {
  private error: DOMException | undefined;
  private muxer: WebMMuxer;
  private encoder: VideoEncoder;
  private timestamp: number = 0;
  private frameCount: number = 0;
  private stopRequested: boolean = false;

  private constructor(
    private map: WebGLMap,
    private worker: Eu4Worker,
    config: EncoderConfig,
    private ctx2d: CanvasRenderingContext2D,
    private fontFamily: string,
    private mapPayload: MapPayload,
    private startDate: MapDate,
    private endDate: MapDate,
    private fps: number,
    private interval: TimelapseEncoderOptions["interval"],
    private freezeFrame: number
  ) {
    this.muxer = new WebMMuxer({
      target: "buffer",
      video: {
        codec: config.webmCodec,
        width: ctx2d.canvas.width,
        height: ctx2d.canvas.height,
      },
    });

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => (this.error = e),
    });

    this.encoder.configure(config);
  }

  create2dFrame(date: string) {
    const ctx2d = this.ctx2d;
    const recordingCanvas = ctx2d.canvas;
    const scale = recordingCanvas.width > 2000 ? 2 : 1;

    // Create rectangle to hold text
    ctx2d.drawImage(this.map.gl.canvas, 0, 0);
    ctx2d.fillStyle = "#20272c";
    ctx2d.fillRect(
      recordingCanvas.width - 130 * scale,
      0,
      130 * scale,
      50 * scale
    );

    ctx2d.fillStyle = "#ffffff";
    ctx2d.textAlign = "right";
    ctx2d.font = `700 ${12 * scale}px ${this.fontFamily}`;
    ctx2d.fillText(`PDX.TOOLS`, recordingCanvas.width - 11 * scale, 15 * scale);
    ctx2d.font = `700 ${20 * scale}px ${this.fontFamily}`;
    ctx2d.fillText(date, recordingCanvas.width - 10 * scale, 35 * scale);
  }

  async *timelapse() {
    const frameDuration = 1_000_000 / this.fps; // microseconds
    for await (const date of dates(
      this.worker,
      this.startDate,
      this.endDate,
      this.interval
    )) {
      if (this.error) {
        throw new Error(this.error.message);
      }

      if (this.stopRequested) {
        return;
      }

      const [primary, secondary] = await this.worker.eu4MapColors({
        ...this.mapPayload,
        date: date.days,
      });

      this.map.updateProvinceColors(primary, secondary);
      this.map.redrawMapNow();
      this.create2dFrame(date.text);

      const frame = new VideoFrame(this.ctx2d.canvas, {
        timestamp: this.timestamp,
        duration: frameDuration,
      });

      this.encoder.encode(frame, {
        // https://github.com/Vanilagy/webm-muxer#video-key-frame-frequency
        keyFrame: (this.frameCount += 1) % 150 == 0,
      });

      frame.close();
      await this.encoder.flush();
      this.timestamp += frameDuration;

      // For some reason the best quality freeze frame is if we encode it as
      // many small frame
      const isFinalFrame = date.days >= this.endDate.days;
      if (isFinalFrame) {
        for (
          let t = this.timestamp;
          t < this.timestamp + this.freezeFrame * 1_000_000;
          t += frameDuration
        ) {
          const frame = new VideoFrame(this.ctx2d.canvas, {
            timestamp: t,
            duration: frameDuration,
          });

          this.encoder.encode(frame, {
            keyFrame: (this.frameCount += 1) % 150 == 0,
          });

          frame.close();
          await this.encoder.flush();
        }
      }

      yield date;
    }
  }

  stop() {
    this.stopRequested = true;
  }

  finish() {
    const out = this.muxer.finalize();
    if (out == null) {
      throw new Error("empty muxer");
    }
    this.encoder.close();

    return out;
  }

  static isSupported() {
    return "VideoEncoder" in window;
  }

  static async create({
    map,
    fps,
    mapPayload,
    startDate,
    endDate,
    worker,
    interval,
    freezeFrame,
  }: TimelapseEncoderOptions) {
    async function findSupportedEncoder() {
      const codecs = [
        { codec: "vp09.00.10.08", webmCodec: "V_VP9" },
        { codec: "vp8", webmCodec: "V_VP8" },
      ] as const;

      for (const codec of codecs) {
        try {
          const canvasRate =
            (recordingCanvas.height * recordingCanvas.width) / 4;
          const bitrate = canvasRate * (fps / 15) + 200_000;
          const support = await VideoEncoder.isConfigSupported({
            codec: codec.codec,
            height: recordingCanvas.height,
            width: recordingCanvas.width,
            bitrateMode: "variable",
            bitrate: Math.min(bitrate, 2_000_000),
            framerate: fps,
          });

          if (support.supported) {
            return { ...codec, ...support.config };
          }
        } catch (ex) {}
      }

      throw new Error("No supported codecs found");
    }

    const recordingCanvas = document.createElement("canvas");
    recordingCanvas.width = map.gl.canvas.width;
    recordingCanvas.height = map.gl.canvas.height;

    const config = await findSupportedEncoder();

    // get 2d context without alpha:
    // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#turn_off_transparency
    const ctx2d = recordingCanvas.getContext("2d", { alpha: false });
    if (ctx2d === null) {
      throw new Error("expected recording canvas 2d contex to be defined");
    }

    const fontFamily = getComputedStyle(document.body).fontFamily;

    return new TimelapseEncoder(
      map,
      worker,
      config,
      ctx2d,
      fontFamily,
      mapPayload,
      startDate,
      endDate,
      fps,
      interval,
      freezeFrame
    );
  }
}
