import path from 'path';
import { fileURLToPath } from 'url';
import TerserPlugin from 'terser-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/spectraview.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'spectraview.min.js' : 'spectraview.js',
      library: 'SpectraView',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'typeof self !== \'undefined\' ? self : this'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              targets: {
                browsers: ['> 1%', 'not dead', 'not ie < 11']
              }
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js'],
      fallback: {
        // For browser compatibility
        "crypto": false,
        "stream": false,
        "buffer": false
      }
    },
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: !isProduction, // Keep console in dev
              drop_debugger: true,
              pure_funcs: isProduction ? ['console.log', 'console.info'] : []
            },
            mangle: isProduction,
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ]
    },
    devtool: isProduction ? false : 'source-map',
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }
  };
};