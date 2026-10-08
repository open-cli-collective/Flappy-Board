SPLIT-FLAP — PORTABLE DISPLAY PACKAGE
Version 1.0.0

No build step, npm dependencies, CDN, analytics, or external font downloads.

START HERE
  Open index.html in a modern browser for the JSON message playground.
  Open catalog-study.html for the original character/grid/scale controls.
  Open API.html for the full contract and integration examples.

EMBED IN AN APPLICATION
  Load visuals.js, core.js, board.js (in that order).
  Create new SplitFlapBoard(hostElement, configuration).
  Call board.show(message). See API.html for the full example.
  Each board owns its own shadow root, timers, and animation lifecycle.

OPTIONAL HTTP SERVER (Node 20+)
  From this directory:
    node server.cjs
  Open http://127.0.0.1:8787/live.html to receive HTTP messages.
  Open http://127.0.0.1:8787/ for the local editor/playground.
  The editor is an independent board; it does not publish to the live channel.

  Example push from another terminal:
    curl http://127.0.0.1:8787/api/message \
      -H 'Content-Type: application/json' \
      -d '{"lines":["  HELLO WORLD","  こんにちは 🤖"]}'

  Optional environment variables:
    HOST=127.0.0.1 (default)
    PORT=8787 (default)
    API_TOKEN=your-token (optional Bearer token for every /api route)

  Localhost, a Tailscale interface, or an application proxy are your choice.
  No Tailscale setup, public hosting, or network exposure is performed by this package.
  When binding to other interfaces, choose authentication and access controls
  appropriate to your application. With API_TOKEN unset, API routes are unauthenticated.
  Token entry in live.html stays in page memory; it is not stored in localStorage.

SCOPE
  One current message per board/channel; latest message wins. Optional server
  state is in memory and resets on restart. No playlist, queue, persistence,
  accounts, multiple named channels, or background service installation.
  Reconnected displays replay the latest message and restart its effects.
  Independent displays are not frame-synchronized.

TESTS
  node --test core.test.cjs server.test.cjs
  Open browser-tests.html to run the browser integration checks.

BROWSER REQUIREMENTS
  A current browser with Intl.Segmenter, Web Animations, ResizeObserver,
  Shadow DOM, and CSS container units. CJK and emoji appearance depends on
  fonts installed on the viewing device. The original study uses a system
  sans-serif font; the packaged API lets the host select a font family.

FILES
  board.js              Browser renderer and public class
  core.js               Pure validation/layout, browser global + Node CommonJS
  visuals.js            CSS and cell markup, isolated inside each shadow root
  index.html            JSON playground with examples
  live.html             Optional server's streaming display
  server.cjs            Optional HTTP/SSE adapter using only Node built-ins
  API.html              API reference and integration examples
  catalog-study.html    Original standalone visual controls
  core.test.cjs         Unicode/layout/timing/validation tests
  server.test.cjs       HTTP/SSE integration test
  browser-tests.html    Renderer and lifecycle tests
