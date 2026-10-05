# Stillpoint

A calm, personalizable new tab page for Firefox.

Place widgets anywhere on a grid. Give the whole page one look with a theme, and set
the background to a colour, your own photo or a rotating photograph. Your settings
stay on your device: there is no account and no server, and nothing is sent to the
developer.

## Features

- **A real grid.** Drag and resize widgets anywhere on the page, with the mouse or the
  keyboard. The grid scales with the window, so the layout holds at any size.
- **Themes and design tokens.** Pick a preset, then change any colour, font, radius or
  shadow for the whole page at once. Stillpoint warns you when text would be hard to
  read on your background.
- **Backgrounds:** a solid colour or gradient, your own photo (blurred or dimmed if you
  like), or a photograph that changes every tab, hour or day. Photos come from Lorem
  Picsum with no setup, or from Unsplash with your own access key and a search.
- **Profiles.** Keep several layouts and switch between them.
- **Import and export** your whole setup as a JSON file.
- **Fast.** The first frame is drawn from a small cache before anything else loads, and
  no network request comes before it.

### Widgets

| Widget      | What it shows                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clock**   | The time, in any time zone, 12- or 24-hour                                                                                                          |
| **Date**    | Today's date, written out, short or in numbers, in any time zone                                                                                    |
| **Search**  | A search box for DuckDuckGo, Google, Bing, Brave, Ecosia, Startpage, Kagi or your own engine                                                        |
| **Links**   | Your favourite sites as tiles, with each site's own icon                                                                                            |
| **Weather** | Current conditions and the next days, from [Open-Meteo](https://open-meteo.com)                                                                     |
| **Quote**   | A quote from a built-in collection, or your own                                                                                                     |
| **Stocks**  | A watchlist with each price and the day's change, from [Twelve Data](https://twelvedata.com) with your free key (US markets, currencies and crypto) |

Every widget's settings, and whether it sits on a card, are in the edit panel. Press
<kbd>E</kbd> on a new tab, or use the **Edit layout** button at the top of the page.

## Install

Stillpoint needs Firefox 140 or later.

It is not yet on addons.mozilla.org. Until it is, build it from source (below) and
load it from `about:debugging` → **This Firefox** → **Load Temporary Add-on**, choosing
`.output/firefox-mv3/manifest.json`. A temporary add-on is removed when Firefox
closes.

## Privacy

A new install makes no network requests. Weather, web photo backgrounds, Links icons
and Stocks contact the service they name, only once you turn them on. Firefox asks for
your consent before Stillpoint sends your location or search words.
[PRIVACY.md](PRIVACY.md) lists every request: where it goes, what it contains and
when.

## Build from source

Requirements: Node.js and npm (developed on Node 26).

```sh
npm ci
npm run build        # Firefox build in .output/firefox-mv3/
npm run zip          # packaged for addons.mozilla.org, in .output/
```

Every dependency is pinned to an exact version in `package-lock.json`.

### Development

```sh
npm run dev          # Firefox with hot reload
npm run test         # unit and component tests (Vitest)
npm run typecheck
npm run lint
npm run format       # Prettier
npm run build:chrome # Chrome build; checks the code stays cross-browser
```

Stillpoint is built with [WXT](https://wxt.dev), React and TypeScript, styled with
plain CSS custom properties. Widgets live in `src/widgets/`; each declares a
[zod](https://zod.dev) schema, and its settings form is generated from it.

User-facing text is in `src/locales/en.yml`. A translation is a new file beside it.
The language follows the browser's.

## Licence

Copyright (C) 2026 Monjoh

Stillpoint is free software: you can redistribute it and/or modify it under the terms
of the GNU General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version. It is distributed in
the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE)
for the full text.

In short: you may study, change and share Stillpoint, but anything you distribute that
is based on it must be released under the GPL too, with its source.

Versions published before 2026-10-05 were released under the MIT License.

Background photographs belong to their photographers and are used under the
[Unsplash License](https://unsplash.com/license); each one is credited on the page.
Weather data is from [Open-Meteo](https://open-meteo.com) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
