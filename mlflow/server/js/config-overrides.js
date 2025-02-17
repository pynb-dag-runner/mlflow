const url = require('url');
const path = require('path');
const fs = require('fs');
const rewirePolyfills = require('react-app-rewire-polyfills');
const rewireDefinePlugin = require('react-app-rewire-define-plugin');
const { override, addBabelPlugins } = require('customize-cra');

// copied from 'react-dev-utils/WebpackDevServerUtils'
function mayProxy(pathname) {
  const maybePublicPath = path.resolve('public', pathname.slice(1));
  return !fs.existsSync(maybePublicPath);
}

/**
 * For 303's we need to rewrite the location to have host of `localhost`.
 */
function rewriteRedirect(proxyRes, req) {
  if (proxyRes.headers['location'] && proxyRes.statusCode === 303) {
    var u = url.parse(proxyRes.headers['location']);
    u.host = req.headers['host'];
    proxyRes.headers['location'] = u.format();
  }
}

/**
 * In Databricks, we send a cookie with a CSRF token and set the path of the cookie as "/mlflow".
 * We need to rewrite the path to "/" for the dev index.html/bundle.js to use the CSRF token.
 */
function rewriteCookies(proxyRes) {
  if (proxyRes.headers['set-cookie'] !== undefined) {
    const newCookies = [];
    proxyRes.headers['set-cookie'].forEach((c) => {
      newCookies.push(c.replace('Path=/mlflow', 'Path=/'));
    });
    proxyRes.headers['set-cookie'] = newCookies;
  }
}

function rewiredOverrides(config, env) {
  config = rewirePolyfills(config, env);
  config = rewireDefinePlugin(config, env, {
    'process.env': {
      HIDE_HEADER: process.env.HIDE_HEADER ? JSON.stringify('true') : JSON.stringify('false'),
      HOST_STATIC_SITE: process.env.HOST_STATIC_SITE === "true",
      HIDE_EXPERIMENT_LIST: process.env.HIDE_EXPERIMENT_LIST
        ? JSON.stringify('true')
        : JSON.stringify('false'),
      SHOW_GDPR_PURGING_MESSAGES: process.env.SHOW_GDPR_PURGING_MESSAGES
        ? JSON.stringify('true')
        : JSON.stringify('false'),
      USE_ABSOLUTE_AJAX_URLS: process.env.USE_ABSOLUTE_AJAX_URLS
        ? JSON.stringify('true')
        : JSON.stringify('false'),
      SHOULD_REDIRECT_IFRAME: process.env.SHOULD_REDIRECT_IFRAME
        ? JSON.stringify('true')
        : JSON.stringify('false'),
    },
  });
  return config;
}

function i18nOverrides(config) {
  config.module.rules = config.module.rules.map((rule) => {
    if (rule.oneOf instanceof Array) {
      return {
        ...rule,
        oneOf: [
          {
            test: [new RegExp(path.join('src/i18n/', '.*json'))],
            use: [
              {
                loader: require.resolve('./I18nCompileLoader'),
              },
            ],
          },
          ...rule.oneOf,
        ],
      };
    }

    return rule;
  });

  return config;
}

module.exports = {
  webpack: override(
    rewiredOverrides,
    i18nOverrides,
    addBabelPlugins([
      require.resolve('babel-plugin-formatjs'),
      {
        idInterpolationPattern: '[sha512:contenthash:base64:6]',
      },
    ]),
  ),
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      const proxyTarget = process.env.MLFLOW_PROXY;
      if (proxyTarget) {
        config.hot = true;
        config.https = true;
        config.proxy = [
          {
            context: function(pathname) {
              return mayProxy(pathname);
            },
            target: proxyTarget,
            secure: false,
            changeOrigin: true,
            ws: true,
            xfwd: true,
            onProxyRes: (proxyRes, req) => {
              rewriteRedirect(proxyRes, req);
              rewriteCookies(proxyRes);
            },
          },
        ];
        config.host = 'localhost';
        config.port = 3000;
      }
      return config;
    };
  },
};
