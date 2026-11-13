const { destinoDaApi } = require('./scripts/destino-da-api.cjs');

const destino = destinoDaApi();
console.log(`Proxy do ng serve: /api vai para ${destino.url} (${destino.origem}).`);

module.exports = {
  '/api': {
    target: destino.url,
    changeOrigin: false,
    logLevel: 'warn',
  },
};
