const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/shinservice',
    createProxyMiddleware({
      target: 'http://vendor.shinservice.ru',
      changeOrigin: true,
      pathRewrite: {
        '^/api/shinservice': '',
      },
    })
  );

  app.use(
    '/api/z34',
    createProxyMiddleware({
      target: 'https://z34.ru',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api/z34': '',
      },
    })
  );

  app.use(
    '/api/shinasu',
    createProxyMiddleware({
      target: 'https://shina.su',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api/shinasu': '',
      },
    })
  );

  app.use(
    '/api/b2b4tochki',
    createProxyMiddleware({
      target: 'https://b2b.4tochki.ru',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api/b2b4tochki': '', 
      },
    })
  );

  app.use(
    '/api/vershina',
    createProxyMiddleware({
      target: 'https://vershinatyres.ru',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api/vershina': '',
      },
    })
  );
};