# Animate Images

A Firefox [userscript](https://en.wikipedia.org/wiki/Userscript): combine with [`image.animation_mode=none`](https://kb.mozillazine.org/Animated_images) to play animated image formats (GIF & WebP) on click.

Supported userscript managers:

- [FireMonkey](https://addons.mozilla.org/en-US/firefox/addon/firemonkey) (as of `2.72`): yes.

- [GreaseMonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey) (as of `4.13`): broken when using `privacy.firstparty.isolate=true`.

- [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey) (as of `5.3.1`):
  * Does not work on pages where JavaScript is disabled (e.g. with uBlock Origin).
  * Does not support `@match <all_urls>` in metadata block: you'll have to add a `*` entry to the "User includes" rules.
  * You'll also want to add a `*` entry to the "User domain whitelist" rules unless you fancy manually whitelisting every request to fetch an image.

- [Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) (as of `2.28.0`): yes.
