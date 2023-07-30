import { main } from "./main.mjs"

class GMShim {

  constructor() {
    this.settings = new Map();
    this.settings.set('debug', true);
    this.settings.set('play_once', false);
    this.settings.set('process_all_images', false);
    this.settings.set('show_timing_stats', false);
    this.info = {
      scriptHandler: 'test shim',
    };
  }

  async fetch(src, opts) {
    console.assert(opts['responseType'] == 'arrayBuffer');
    return fetch(src, opts).then(r => r.arrayBuffer().then(b => ({arrayBuffer: b})));
  }

  async getValue(key, def) {
    return new Promise((resolve, _reject) => {
      resolve(this.settings.has(key) ? this.settings.get(key) : def);
    });
  }

  async setValue(key, value) {
    return new Promise((resolve, _reject) => {
      this.settings.set(key, value);
      resolve();
    });
  }

  registerMenuCommand(name, onclick) {
    const button = document.createElement('button');
    button.append(name);
    button.onclick = onclick;
    document.querySelector('#commands').appendChild(button);
  }

  xmlHttpRequest(params) {
    const xhr = new XMLHttpRequest();
    xhr.responseType = params.responseType;
    xhr.onload = _e => params.onload(xhr);
    xhr.onerror = _e => params.onerror(xhr);
    xhr.open(params.method, params.url, true);
    xhr.send(null);
  }

  notification(params) {
    console.log(`${params.title}\n${params.text}`);
    Notification.requestPermission().then(() => new Notification(params.title, { body: params.text }));
  }
}

(function() {
  const settings = document.querySelectorAll('#settings > input');
  const button = document.querySelector('#enable_test_code');
  button.onclick = () => {
    const shim = new GMShim();
    main(shim, window);
    for (const b of settings) {
      console.log(b.id);
      b.disabled = false;
      b.checked = shim.settings.get(b.id);
      b.onclick = () => {
        shim.settings.set(b.id, true);
      }
    }
    button.style.display = 'none';
  };
})();

// vim: expandtab sw=2
