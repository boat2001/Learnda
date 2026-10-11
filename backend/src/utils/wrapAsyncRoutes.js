// Express 4 does not forward rejected route promises to its error middleware.
// Cover every mounted router, including legacy controllers without try/catch.
function wrapAsyncRoutes(router, visited = new Set()) {
  if (!router || visited.has(router)) return;
  visited.add(router);
  for (const layer of router.stack || []) {
    if (layer.route) {
      for (const handler of layer.route.stack) {
        const original = handler.handle;
        if (original.length > 3) continue;
        handler.handle = function asyncSafeRoute(req, res, next) {
          Promise.resolve(original(req, res, next)).catch(next);
        };
      }
    } else if (layer.handle?.stack) {
      wrapAsyncRoutes(layer.handle, visited);
    }
  }
}

module.exports = wrapAsyncRoutes;
