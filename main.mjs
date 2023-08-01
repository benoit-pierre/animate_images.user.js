import * as Formats from "./formats.mjs"
import { default as HelpersModule } from "./helpers.mjs"

export async function main(GM, unsafeWindow) {

  const settings = {
    debug: false,
    play_once: false,
    process_all_images: false,
    show_timing_stats: false,
  };

  // Keep track of track of last focused image.
  let last_focused_img = null;

  let Helpers;

  function log(...args) {
    if (settings.debug) {
      console.debug(...args);
    }
  }

  for (const key of Object.keys(settings)) {
    settings[key] = await GM.getValue(key, settings[key]);
    if (typeof GM.registerMenuCommand === "function") {
      GM.registerMenuCommand(`Toggle ${key}`, () => {
        GM.setValue(key, settings[key] = !settings[key]);
        GM.notification({
          title: 'Animate Images',
          text: `settings.${key}: ${settings[key]}`,
        });
      });
    }
  }
  if (typeof GM.addValueChangeListener === "function") {
    const on_setting_changed = (key, _old_value, new_value, remote) => {
        if (remote) {
          settings[key] = new_value;
          log(`settings.${key}: ${settings[key]}`);
        }
    };
    for (const key of Object.keys(settings)) {
      GM.addValueChangeListener(key, on_setting_changed);
    }
  }

  log('Animate GIF using', GM.info.scriptHandler, JSON.stringify(settings));

  function copy_array(src) {
    const dst = new Uint8Array(src.byteLength);
    dst.set(new Uint8Array(src));
    return dst;
  }

  const fetch_buffer = (
    typeof GM.fetch === "function"
    // FireMonkey.
    ? href => GM.fetch(href, {
      method: 'GET',
      cache: 'force-cache',
      responseType: 'arrayBuffer',
    }).then(r => copy_array(r.arrayBuffer))
    // Other script managers.
    : href => new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        url: href,
        method: 'GET',
        responseType: 'arraybuffer',
        onload: r => resolve(new Uint8Array(r.response)),
        onerror: r => reject(r),
      });
    })
  );

  if (typeof GM.addStyle !== "function") {
    log('GM.addStyle is undefined');
    GM.addStyle = (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.body || document.documentElement || document).appendChild(style);
    };
  }

  class Decoder {

    constructor(cbuffer, cbuffer_size, handler) {
      this.format = handler.format;
      this.cbuffer = cbuffer;
      this.handler = handler;
      this.reader = handler.create(cbuffer, cbuffer_size);
      this.width = handler.canvas_width(this.reader);
      this.height = handler.canvas_height(this.reader);
      this.frameCount = handler.frame_count(this.reader);
      this.loopCount = handler.loop_count(this.reader);
      this.frameIndex = -1;
      this.frameDuration = -1;
      this.frameImage = null;
    }

    delete() {
      this.handler.destroy(this.reader);
      Helpers._free(this.cbuffer);
    }

    rewind() {
      this.handler.rewind(this.reader);
      this.frameIndex = -1;
      this.frameDuration = -1;
    }

    drawFrame(context) {
      context.putImageData(this.frameImage, 0, 0);
    }

    decodeNextFrame(context) {
      if (this.frameImage === null) {
        this.frameImage = context.getImageData(0, 0, this.width, this.height);
      }
      this.handler.decode_next_frame(this.reader);
      this.frameIndex = this.handler.frame_index(this.reader);
      this.frameDuration = this.handler.frame_duration(this.reader);
      if (this.frameDuration === 0 || this.frameDuration < 20) {
        this.frameDuration = 100;
      }
      const rgba_ptr = this.handler.frame_rgba(this.reader);
      const rgba_size = this.width * this.height * 4;
      const rgba = Helpers.HEAPU8.subarray(rgba_ptr, rgba_ptr + rgba_size);
      this.frameImage.data.set(rgba);
    }
  }

  async function get_decoder(buffer) {
    const format = Formats.probe_buffer_format(buffer);
    if (format === null) {
      return null;
    }
    if (!Helpers) {
      Helpers = await HelpersModule();
      Helpers.image_readers = {};
      for (const name of Formats.supported_formats) {
        const id = name.toLowerCase();
        const handler = {format: name}
        for (const method of `
             create destroy
             canvas_width canvas_height
             frame_count loop_count
             rewind decode_next_frame
             frame_index frame_duration frame_rgba
        `.split(/\s+/)) {
          handler[method] = Helpers[`_${id}_reader_${method}`];
        }
        Helpers.image_readers[name] = handler;
      }
    }
    const handler = Helpers.image_readers[format];
    const cbuffer = Helpers._malloc(buffer.length)
    try {
      Helpers.HEAPU8.set(buffer, cbuffer)
      return new Decoder(cbuffer, buffer.length, handler);
    } catch (e) {
      Helpers._free(cbuffer);
      throw e;
    }
  }

  function get_element_viewport(element, style) {
    // FIXME: margins can screw up things…
    // First get the border and padding values.
    if (!style) {
      style = getComputedStyle(element);
    }
    const border_left = parseFloat(style.borderLeftWidth);
    const border_width = border_left + parseFloat(style.borderRightWidth);
    const border_top = parseFloat(style.borderTopWidth);
    const border_height = border_top + parseFloat(style.borderBottomWidth);
    const padding_left = parseFloat(style.paddingLeft);
    const padding_width = padding_left + parseFloat(style.paddingRight)
    const padding_top = parseFloat(style.paddingTop);
    const padding_height = padding_top + parseFloat(style.paddingBottom);
    // Get the current bounding rect, including the border-box.
    const rect = element.getBoundingClientRect();
    const viewport = {};
    // We need to get the current scale since the computed values don't know about it…
    viewport.xscale = 1 / (element.offsetWidth / rect.width);
    viewport.yscale = 1 / (element.offsetHeight / rect.height);
    viewport.padding_left = padding_left * viewport.xscale;
    viewport.padding_top = padding_top * viewport.xscale;
    viewport.left = rect.left + (border_left + padding_left) * viewport.xscale;
    viewport.top = rect.top + (border_top + padding_top) * viewport.yscale;
    viewport.width = rect.width - (border_width + padding_width) * viewport.xscale;
    viewport.height = rect.height - (border_height + padding_height) * viewport.yscale;
    // The real displayed height and width without border nor padding.
    return viewport;
  }

  class TimingStats {

    constructor(max, x, y, width, height) {
      this.max = max;
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.bar_width = 2;
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.context = this.canvas.getContext('2d');
      this.context.fillStyle = "rgb(0,0,255)";
      this.count = Math.trunc(this.canvas.width / this.bar_width);
      this.index = 0;
    }

    update(context, timing) {
      const height = Math.min(Math.round(timing * this.height / this.max), this.height);
      this.context.clearRect(this.index * this.bar_width, 0, this.bar_width, this.height);
      const color = Math.round(height * 255 / this.height);
      this.context.fillStyle = `rgb(${color},${255-color},0)`;
      this.context.fillRect(this.index * this.bar_width, this.height - height, this.bar_width, height);
      this.index = (this.index + 1) % this.count;
      context.drawImage(this.canvas, this.x, this.y);
    }
  }

  class Player {

    constructor(id) {
      this.id = id;
      this.body = null;
      this.img = null;
      this.src = null;
      this.decoder = null;
      this.playing = false;
      this.frame_ready = null;
      this.animation = null;
      this.timeout = null;
      this.loops = 0;
      this.next_timestamp = null;
      this.visibility_observer = null;
      this.timing_stats = null;
      this.mousemove_tid = null;
      this.mousemove_positions = null;
      this.mousemove_num_samples = 10;
    }

    setup() {
      log('player.setup', this.id);
      GM.addStyle(`
        /* Hide image while playing. */
        .animage_image.animage_playing {
          opacity: 0 !important;
        }

        /* Prevent image CSS transitions from making a mess. */
        .animage_image {
          transition: none !important;
          animation: none !important;
        }
        `);
      document.body.insertAdjacentHTML('beforeend', `
        <div id="animage_${this.id}">
        </div>
        `);
      this.body = document.querySelector(`#animage_${this.id}`);
      const shadow = this.body.attachShadow({mode: 'closed'});
      shadow.innerHTML = `
        <style>
          :host(#animage_${this.id}) {
            background-color: rgba(0, 0, 0, 0) !important;
            position: absolute;
            pointer-events: none;
            border: 0;
            margin: 0;
            padding: 0;
            align-items: center;
            justify-content: center;
          }

          :host(.animage_enabled) {
            display: flex !important;
          }

          :host(:not(.animage_enabled)) {
            display: none;
          }

          canvas {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            border: 0;
            margin: 0;
            padding: 0;
            opacity: 0;
          }

          /* Show canvas when something is drawn. */
          canvas.drawn {
            opacity: 1;
          }

          .control {
            display: flex;
            z-index: 666;
            width: 48px;
            height: 48px;
            cursor: pointer;
            pointer-events: auto;
            align-items: center;
            justify-content: center;
            opacity: 0;
            margin: 0;
            padding: 0;
            background: rgb(29, 161, 242);
            border-color: white;
            border-radius: 50%;
            border-style: solid;
            border-width: 3px;
          }

          /* Show control when hovering over it or over the image. */
          .control:hover, .control.shown {
            opacity: 1;
            background: rgb(29, 141, 242);
          }

          /* Hide control when activated. */
          .control.activated {
            opacity: 0;
          }

          .icon {
            width: calc(50% + 3px);
            height: calc(50% + 3px);
            background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path fill='white' stroke='white' stroke-width='1.5' stroke-linejoin='round' d='M 4,2 V 14 L 14,8 Z'/></svg>");
            background-position: right top;
            background-repeat: no-repeat;
            background-size: 100%;
          }

          :host(.animage_playing) .icon {
            background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'><path fill='white' stroke='white' stroke-width='1.5' stroke-linejoin='round' d='M 3,3 H 13 V 13 H 3 Z'/></svg>");
          }
        </style>
        <canvas></canvas>
        <div class="control">
          <span class="icon"></span>
        </div>
        `;
      this.canvas = shadow.querySelector('canvas');
      this.context = this.canvas.getContext('2d');
      this.control = shadow.querySelector('.control');
      this.control.addEventListener('click', evt => {
        evt.stopPropagation();
        evt.preventDefault();
        if (this.animation) {
          this.stop();
        } else {
          this.play();
        }
      }, true);
      this.control.addEventListener('mouseleave', evt => {
        evt.stopPropagation();
        this.control.classList.remove('activated');
        this.mousemove_positions = [];
      });
      // Stop animation if element is out of view.
      this.visibility_observer = new IntersectionObserver(entries => {
        if (entries[0].intersectionRatio <= 0) {
          this.stop();
        }
      });
      this.visibility_observer.observe(this.body);
      // Stop animation if page does not have focus.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.stop();
        }
      });
      this.animate = this.animate.bind(this);
      this.on_image_mouseenter = this.on_image_mouseenter.bind(this);
      this.on_image_mouseleave = this.on_image_mouseleave.bind(this);
      this.on_image_mousemove = this.on_image_mousemove.bind(this);
    }

    prepareNextFrame() {
      this.frame_ready = new Promise(resolve => {
        this.timeout = setTimeout(
          () => resolve(this.decoder.decodeNextFrame(this.context)))
      });
      return this.frame_ready;
    }

    async animate(timestamp) {
      if (timestamp >= this.next_timestamp) {
        if (!this.next_timestamp) {
          this.next_timestamp = timestamp;
        }
        await this.frame_ready;
        this.decoder.drawFrame(this.context);
        const duration = this.decoder.frameDuration;
        if (this.decoder.frameIndex + 1 === this.decoder.frameCount) {
          if (settings.play_once || --this.loops === 0) {
            this.stop();
            return;
          }
        }
        this.img.classList.add('animage_playing');
        this.canvas.classList.add('drawn');
        this.prepareNextFrame();
        const now = performance.now();
        if (this.timing_stats) {
          const delta = Math.max(0, now - this.next_timestamp);
          this.timing_stats.update(this.context, delta);
        }
        this.next_timestamp += duration;
        if (this.next_timestamp <= timestamp) {
          // We're too slow…
          this.next_timestamp = timestamp;
        }
      }
      this.animation = window.requestAnimationFrame(this.animate);
    }

    async play() {
      if (this.playing) {
        return;
      }
      log('player.play', this.id);
      if (settings.show_timing_stats) {
        this.timing_stats = new TimingStats(50,
                                            0, this.canvas.height - 50,
                                            this.canvas.width, 50);
      }
      this.loops = this.decoder.loopCount;
      this.next_timestamp = 0;
      this.body.classList.add('animage_playing');
      this.control.classList.add('activated');
      this.decoder.rewind();
      await this.prepareNextFrame();
      this.animation = window.requestAnimationFrame(this.animate);
      this.playing = true;
    }

    stop() {
      if (!this.playing) {
        return;
      }
      log('player.stop', this.id);
      // N.B.: need to use `unsafeWindow` to support ViolentMonkey…
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = 0;
      }
      if (this.animation) {
        unsafeWindow.cancelAnimationFrame(this.animation);
        this.animation = 0;
      }
      this.img.classList.remove('animage_playing');
      this.body.classList.remove('animage_playing');
      this.control.classList.remove('activated');
      this.canvas.classList.remove('drawn');
      this.timing_stats = null;
      this.playing = false;
    }

    show_control() {
      if (this.mousemove_tid)
        this.mousemove_tid = clearTimeout(this.mousemove_tid);
      this.control.classList.add('shown');
      this.mousemove_tid = setTimeout(() => {
        this.control.classList.remove('shown')
        this.mousemove_positions = [];
      }, 1000);
    }

    hide_control() {
      if (this.mousemove_tid)
        this.mousemove_tid = clearTimeout(this.mousemove_tid);
      this.control.classList.remove('shown');
      this.mousemove_positions = [];
    }

    on_image_mouseenter() {
      if (!this.animation)
        this.show_control();
    }

    on_image_mouseleave() {
      this.hide_control();
    }

    on_image_mousemove(evt) {
      this.mousemove_positions.push([evt.offsetX, evt.offsetY]);
      if (this.mousemove_positions.length < this.mousemove_num_samples)
        return;
      if (this.mousemove_positions.length > this.mousemove_num_samples)
        this.mousemove_positions.shift()
      let distance = index => Math.sqrt(
        Math.pow(this.img.width / 2 - this.mousemove_positions[index][0], 2)
        +
        Math.pow(this.img.height / 2 - this.mousemove_positions[index][1], 2)
      );
      let delta = distance(this.mousemove_num_samples -1) - distance(0);
      if (delta < 0)
        this.show_control();
    }

    enable(img, src, decoder) {
      if (!this.body) {
        this.setup();
      }
      this.disable();
      log('player.enable', this.id, img.currentSrc);
      const style = getComputedStyle(img);
      const viewport = get_element_viewport(img, style);
      let anchor = img.offsetParent;
      for (; anchor; anchor = anchor.offsetParent) {
        const style = getComputedStyle(anchor);
        if (style.position === 'absolute' || style.position === 'relative') {
          break;
        }
      }
      if (anchor) {
        const anchor_viewport = get_element_viewport(anchor);
        this.body.style.left = `${viewport.left - anchor_viewport.left + anchor_viewport.padding_left}px`;
        this.body.style.top = `${viewport.top - anchor_viewport.top + anchor_viewport.padding_top}px`;
      }
      else {
        this.body.style.left = `${window.pageXOffset + viewport.left}px`;
        this.body.style.top = `${window.pageYOffset + viewport.top}px`;
      }
      this.body.classList.remove('animage_playing');
      this.img = img;
      this.src = src;
      this.decoder = decoder;
      this.body.style.width = `${viewport.width}px`;
      this.body.style.height = `${viewport.height}px`;
      this.canvas.width = decoder.width;
      this.canvas.height = decoder.height;
      for (let field of ['attachment', 'scroll', 'blend-mode', 'clip', 'color', 'image',
        'origin', 'position', 'position-x', 'position-y', 'repeat', 'size']) {
        field = 'background-' + field;
        this.canvas.style[field] = style[field];
      }
      this.mousemove_positions = [];
      img.addEventListener('mouseenter', this.on_image_mouseenter);
      img.addEventListener('mouseleave', this.on_image_mouseleave);
      img.addEventListener('mousemove', this.on_image_mousemove);
      img.classList.add('animage_image');
      img.parentElement.appendChild(this.body);
      this.body.classList.add('animage_enabled');
      this.control.classList.add('shown');
    }

    disable() {
      if (!this.body.classList.contains('animage_enabled')) {
        return;
      }
      this.hide_control();
      this.stop();
      log('player.disable', this.id);
      this.body.classList.remove('animage_enabled');
      this.img.classList.remove('animage_image');
      this.img.removeEventListener('mouseenter', this.on_image_mouseenter);
      this.img.removeEventListener('mouseleave', this.on_image_mouseleave);
      this.img.removeEventListener('mousemove', this.on_image_mousemove);
      this.img = null;
      this.src = null;
      this.decoder.delete();
      this.decoder = null;
      this.frame_ready = null;
      this.mousemove_positions = [];
    }
  }

  class Director {

    constructor(max_players=2) {
      console.assert(max_players > 0);
      this.stopped = [];
      for (let n = 0; n < max_players; ++n) {
        const player = new Player(String(n+1));
        player.play = () => this.play(player);
        player.stop = () => this.stop(player);
        this.stopped.push(player);
      }
      this.playing = null;
    }

    player_for(img) {
      if (this.playing && this.playing.img === img)
        return this.playing;
      for (const player of this.stopped)
        if (player.img === img)
          return player;
      return null;
    }

    enable(img, src, decoder) {
      const player = this.stopped.shift() || this.playing;
      this.stopped.push(player);
      player.enable(img, src, decoder);
    }

    play(player) {
      if (this.playing) {
        this.playing.stop();
      }
      this.playing = player;
      const index = this.stopped.indexOf(player);
      if (index >= 0)
        this.stopped.splice(index, 1)
      Player.prototype.play.call(player);
    }

    stop(player) {
      Player.prototype.stop.call(player);
      if (player === this.playing) {
        this.stopped.push(player);
        this.playing = null;
      }
    }
  }

  const director = new Director();

  async function process_image(img, src) {
    const url = new URL(src);
    if (!settings.process_all_images && Formats.probe_url_format(url) === null) {
      return;
    }
    log('process', src, img);
    const onerror = e => console.log('processing', src, 'failed:', e);
    const buffer = await fetch_buffer(src).catch(onerror);
    if (!buffer) {
      return;
    }
    if (img !== last_focused_img) {
      return;
    }
    const decoder = await get_decoder(buffer).catch(onerror);
    if (!decoder) {
      log('unsupported image format', src, img);
      return;
    }
    log(src, 'is a', decoder.format, 'with', decoder.frameCount, 'frames');
    if (decoder.frameCount <= 1 || img !== last_focused_img) {
      decoder.delete();
      return;
    }
    director.enable(img, src, decoder);
  }

  function on_image_loaded(evt) {
    const img = evt.target;
    img.removeEventListener('load', on_image_loaded);
    if (img !== last_focused_img) {
      return;
    }
    log('loaded', img.currentSrc);
    process_image(img, img.currentSrc);
  }

  function on_mouse_over(evt) {
    evt.stopPropagation();
    if (evt.target.nodeName !== 'IMG') {
      return;
    }
    last_focused_img = evt.target;
    const player = director.player_for(last_focused_img);
    if (player) {
      if (player.img === last_focused_img && 
          player.src === last_focused_img.currentSrc) {
        return;
      }
      player.disable();
    }
    if (last_focused_img.complete) {
      process_image(last_focused_img, last_focused_img.currentSrc);
    } else {
      last_focused_img.addEventListener('load', on_image_loaded);
    }
  }

  document.body.onmouseover = on_mouse_over;
}

// vim: expandtab sw=2
