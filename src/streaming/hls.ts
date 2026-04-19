import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export class HLSStreamer {
  private hlsDir = path.join(process.cwd(), 'hls');
  private ffmpegProcesses = new Map<string, ChildProcess>();
  private waitingForKeyframe = new Set<string>();
  private readonly hlsSegmentSeconds = Math.max(1, Number(process.env.HLS_SEGMENT_SECONDS || 2));
  private readonly hlsListSize = Math.max(2, Number(process.env.HLS_LIST_SIZE || 2));
  private readonly hlsOutputFps = Math.max(10, Number(process.env.HLS_OUTPUT_FPS || 20));
  private readonly hlsGop = Math.max(this.hlsOutputFps, Number(process.env.HLS_GOP_SIZE || this.hlsOutputFps * 2));
  private readonly hlsPreset = String(process.env.HLS_X264_PRESET || 'veryfast').trim() || 'veryfast';
  private readonly hlsCrf = Math.max(16, Math.min(30, Number(process.env.HLS_X264_CRF || 20) || 20));
  private readonly hlsProfile = String(process.env.HLS_X264_PROFILE || 'main').trim() || 'main';
  private readonly hlsLevel = String(process.env.HLS_X264_LEVEL || '4.0').trim() || '4.0';
  private readonly hlsMaxRate = String(process.env.HLS_MAX_RATE || '3000k').trim() || '3000k';
  private readonly hlsBufSize = String(process.env.HLS_BUF_SIZE || '6000k').trim() || '6000k';
  private readonly hlsVideoMode = String(process.env.HLS_VIDEO_MODE || 'legacy').trim().toLowerCase();
  private readonly waitForKeyframeOnStart = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.HLS_WAIT_FOR_KEYFRAME || (this.hlsVideoMode === 'reencode' ? 'true' : 'false')).trim().toLowerCase()
  );

  constructor() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  startStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    if (this.ffmpegProcesses.has(streamKey)) {
      console.log(`HLS stream already running: ${streamKey}`);
      return;
    }

    const outputDir = path.join(this.hlsDir, vehicleId, `channel_${channel}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    console.log(`Starting FFmpeg HLS stream: ${streamKey}`);
    console.log(`   Output: ${playlistPath}`);

    const ffmpegArgs = this.hlsVideoMode === 'reencode'
      ? [
          '-hide_banner',
          '-loglevel', 'warning',
          '-y',
          '-f', 'h264',
          '-fflags', '+genpts+discardcorrupt+nobuffer+flush_packets',
          '-flags', 'low_delay',
          '-analyzeduration', '2M',
          '-probesize', '2M',
          '-max_delay', '0',
          '-use_wallclock_as_timestamps', '1',
          '-i', 'pipe:0',
          '-map', '0:v:0',
          '-an',
          '-vf', 'format=yuv420p',
          '-r', String(this.hlsOutputFps),
          '-c:v', 'libx264',
          '-preset', this.hlsPreset,
          '-crf', String(this.hlsCrf),
          '-tune', 'zerolatency',
          '-pix_fmt', 'yuv420p',
          '-profile:v', this.hlsProfile,
          '-level', this.hlsLevel,
          '-maxrate', this.hlsMaxRate,
          '-bufsize', this.hlsBufSize,
          '-g', String(this.hlsGop),
          '-keyint_min', String(this.hlsOutputFps),
          '-sc_threshold', '0',
          '-force_key_frames', `expr:gte(t,n_forced*${this.hlsSegmentSeconds})`,
          '-x264-params', `keyint=${this.hlsGop}:min-keyint=${this.hlsOutputFps}:scenecut=0:open-gop=0`,
          '-fflags', '+flush_packets',
          '-max_interleave_delta', '0',
          '-muxdelay', '0',
          '-muxpreload', '0',
          '-f', 'hls',
          '-hls_time', String(this.hlsSegmentSeconds),
          '-hls_list_size', String(this.hlsListSize),
          '-hls_flags', 'delete_segments+append_list+omit_endlist+independent_segments+temp_file',
          '-hls_segment_type', 'mpegts',
          '-hls_segment_filename', path.join(outputDir, 'seg%03d.ts'),
          '-start_number', '0',
          '-threads', '0',
          '-flush_packets', '1',
          '-max_muxing_queue_size', '2048',
          playlistPath
        ]
      : [
          '-hide_banner',
          '-loglevel', 'warning',
          '-y',
          '-re',
          '-f', 'h264',
          '-fflags', '+nobuffer+fastseek+flush_packets',
          '-flags', 'low_delay',
          '-analyzeduration', '1',
          '-probesize', '32',
          '-max_delay', '0',
          '-i', 'pipe:0',
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-copyts',
          '-start_at_zero',
          '-avoid_negative_ts', 'make_zero',
          '-f', 'hls',
          '-hls_time', String(this.hlsSegmentSeconds),
          '-hls_list_size', String(this.hlsListSize),
          '-hls_flags', 'delete_segments+append_list+omit_endlist+split_by_time',
          '-hls_segment_type', 'mpegts',
          '-hls_segment_filename', path.join(outputDir, 'seg%03d.ts'),
          '-start_number', '0',
          '-threads', '0',
          '-flush_packets', '1',
          '-max_muxing_queue_size', '2048',
          '-muxdelay', '0',
          '-muxpreload', '0',
          playlistPath
        ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('error') || msg.includes('Error')) {
        console.error(`FFmpeg error [${streamKey}]:`, msg);
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg closed [${streamKey}]: code ${code}`);
      this.ffmpegProcesses.delete(streamKey);
    });

    ffmpeg.on('error', (err) => {
      console.error(`FFmpeg spawn error [${streamKey}]:`, err);
    });

    ffmpeg.stdin.on('error', (err) => {
      console.error(`FFmpeg stdin error [${streamKey}]:`, err.message);
    });

    this.ffmpegProcesses.set(streamKey, ffmpeg);
    if (this.waitForKeyframeOnStart) {
      this.waitingForKeyframe.add(streamKey);
    }
    console.log(`FFmpeg process started: ${streamKey}`);
  }

  writeFrame(vehicleId: string, channel: number, frame: Buffer, isKeyframe = false): void {
    const streamKey = `${vehicleId}_${channel}`;
    const ffmpeg = this.ffmpegProcesses.get(streamKey);

    if (!ffmpeg) {
      console.warn(`No FFmpeg process for ${streamKey}`);
      return;
    }

    if (!ffmpeg.stdin) {
      console.warn(`FFmpeg stdin is null for ${streamKey}`);
      return;
    }

    if (!ffmpeg.stdin.writable) {
      console.warn(`FFmpeg stdin not writable for ${streamKey}`);
      return;
    }

    if (this.waitForKeyframeOnStart && this.waitingForKeyframe.has(streamKey)) {
      if (!isKeyframe) {
        return;
      }
      this.waitingForKeyframe.delete(streamKey);
      console.log(`HLS stream locked to first keyframe: ${streamKey}`);
    }

    const written = ffmpeg.stdin.write(frame);
    if (!written) {
      console.warn(`FFmpeg stdin buffer full for ${streamKey}`);
    }
  }

  stopStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    const ffmpeg = this.ffmpegProcesses.get(streamKey);
    if (ffmpeg) {
      ffmpeg.stdin?.end();
      ffmpeg.kill();
      this.ffmpegProcesses.delete(streamKey);
    }
    this.waitingForKeyframe.delete(streamKey);
  }

  getPlaylistPath(vehicleId: string, channel: number): string {
    return `/api/stream/${vehicleId}/${channel}/playlist.m3u8`;
  }
}
