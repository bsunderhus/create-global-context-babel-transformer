const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV == 'production';

/**
 * @type {import('webpack').Configuration}
 */
const config = {
  entry: './src/index.tsx',
  mode: isProduction ? 'production' : 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    open: true,
    host: 'localhost',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/i,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@global-context/babel-preset']],
          },
        },
        include: [/src\/fake_node_modules\/context-.+/],
      },
      {
        test: /\.(ts|tsx)$/i,
        use: ['ts-loader'],
        exclude: ['/node_modules/'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};

module.exports = config;
