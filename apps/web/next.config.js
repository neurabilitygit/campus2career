const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const explicitDistDir = process.env.NEXT_DIST_DIR;

  return {
    // Keep dev and production output isolated so running `next build`
    // cannot invalidate a live `next dev` session.
    distDir: explicitDistDir || (isDevServer ? ".next-dev" : ".next"),
  };
};
