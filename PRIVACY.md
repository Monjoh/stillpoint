# Privacy

Stillpoint has no account, no server, no analytics and no tracking. Nothing is ever
sent to the developer.

Your settings, photos and cached data stay in your browser's extension storage on this
device. They leave it only if you export them to a file yourself.

A new install makes no network requests. Requests start only when you turn on a
feature that needs one, and each goes straight to the service named below. They are
sent without cookies, and the photo and icon requests also omit the referrer. Stillpoint
fetches nothing before a new tab has painted: widgets show their last saved data first,
then update.

## What is sent, and where

| Feature                        | Sent to                                                                              | What is sent                                                                                                                 | When                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Weather**: finding a place   | [Open-Meteo](https://open-meteo.com/en/terms) (`geocoding-api.open-meteo.com`)       | The place name you type, and your browser's language                                                                         | While you search in the widget's settings                                                                |
| **Weather**: the forecast      | Open-Meteo (`api.open-meteo.com`)                                                    | The place's coordinates, rounded to about 1 km, and your choice of units                                                     | At most every 30 minutes, while a new tab is open                                                        |
| **Weather**: "Use my location" | Firefox's own location service, not Stillpoint                                       | Whatever Firefox sends to locate you; Firefox asks you first                                                                 | Once, when you click the button. Stillpoint keeps only the rounded coordinates                           |
| **Background**: Lorem Picsum   | [Lorem Picsum](https://picsum.photos) (`picsum.photos`)                              | A request for a page of the photo list, then the photos themselves                                                           | When the photo is due to change (every tab, hourly or daily, your choice). Photos are fetched in batches |
| **Background**: Unsplash       | [Unsplash](https://unsplash.com/privacy) (`api.unsplash.com`, `images.unsplash.com`) | Your Unsplash access key and your search words. A "download" notice for each photo shown, which Unsplash's API terms require | Same as above                                                                                            |
| **Links**: site icons          | Each linked site                                                                     | A request for that site's own icon (`/apple-touch-icon.png`, then `/favicon.ico`)                                            | Each time the widget shows, cached by the browser. Never for local or private-network addresses          |
| **Stocks**                     | [Twelve Data](https://twelvedata.com/privacy) (`api.twelvedata.com`)                 | The symbols on your watchlist and your Twelve Data API key                                                                   | Every 15, 30 or 60 minutes (your choice), while a new tab is open                                        |
| **Search**                     | The search engine you picked                                                         | Your search words                                                                                                            | Only when you press Enter. The tab simply navigates there; there are no suggestions as you type          |

Clicking a link (a photographer's credit, a link tile, a search) opens that site like
any other link would. A credit link to Unsplash carries `utm_source=stillpoint`, which
Unsplash's terms ask for.

The Clock, Date and Quote widgets, themes, and your own photos make no requests. Quotes
are built into the extension.

## Permissions

- **Storage** (`storage`), to keep your settings on this device. This is the only
  permission asked for at install, and there are no site permissions: every
  service above lets the extension read its answers without one.
- **Firefox's data-collection categories**, optional:
  - _Location_ (`locationInfo`): asked for when you set a place for Weather.
  - _Search terms_ (`searchTerms`): asked for when you search for Unsplash
    backgrounds.

  Each is asked for from the click that turns the feature on. Without it, that
  feature stays off and nothing else changes. You can withdraw either one in
  `about:addons`.

Three features send something but are not declared as data collection, since none
sends your personal data to the developer or to a service of Stillpoint's choosing:

- **Search** sends your words only by taking you to the engine you picked, exactly as
  typing in the address bar would.
- **Link icons** are each site's own icon, requested from the site you added.
- **Stock symbols** are public ticker names, not information about your finances.

## Keys and exports

An Unsplash access key or a Twelve Data API key is stored with your settings, so it
is included when you export them to a file. Remove it from the file before sharing it.

## Changes

Any change to what Stillpoint sends will be listed here, and the version history of
this file is public.
