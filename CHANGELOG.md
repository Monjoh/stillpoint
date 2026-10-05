# Changelog

What changed in each version of Stillpoint, newest first. The version is the one in
`package.json`, which is also the add-on's version on addons.mozilla.org. Each release
is tagged in git as `v<version>`.

Numbering: a fix raises the last number (1.0.1), a new feature the middle one (1.1.0),
and a change that breaks how something used to work the first (2.0.0).

## 1.1.0 — unreleased

Two new widgets:

- **World clocks:** the time in several cities at once, with how many hours ahead or
  behind each one is, and whether it is already tomorrow there. London, New York and
  Tokyo to start with; add up to twelve.
- **Countdown:** the days left until a date, such as a holiday or a deadline. It can
  also show the days, hours and minutes, down to a time of day you set. Once the
  date has passed, it counts the time since.

Accessibility, for keyboard and screen-reader users:

- The page has landmarks, so a screen reader can jump straight to the widgets or to
  the controls.
- The "Add widget" menu works as a menu: the arrow keys, Home and End move through
  it, a letter jumps to the next widget starting with it, and Tab or Escape closes
  it. Categories and descriptions are read out.
- Moving, resizing, duplicating or removing a widget with the keyboard is announced:
  "Clock moved to column 2, row 1", "Another widget is in the way", and so on.
- Each widget in edit mode says how to move it.
- After a widget is removed, the keyboard focus moves to the next widget, or stays
  in the settings panel, instead of being lost.
- Text fields, menus and switches in the settings have a clearly visible edge.

## 1.0.0 — 2026-10-05

The first release.

- **A grid you arrange yourself.** Place widgets anywhere; drag and resize them with
  the mouse or the keyboard. The grid scales with the window.
- **Nine widgets:** Clock, Date, Search, Links, Weather, Quote, Stocks (with a free
  Twelve Data key), Notes and To-do.
- **One look for the whole page:** four themes, with any colour, font, corner or
  shadow changed page-wide, and a warning when text would be hard to read.
- **Backgrounds:** a colour or gradient, your own photo, or a photograph that changes
  every tab, hour or day, from Lorem Picsum or from Unsplash with your own key.
- **Profiles,** and import and export of everything as a file.
- **Private by design:** no account, no server, no analytics. A new install makes no
  network requests, and Firefox asks before your location or search words are sent.
  See [PRIVACY.md](PRIVACY.md).
- English, following the browser's language once translations exist.
