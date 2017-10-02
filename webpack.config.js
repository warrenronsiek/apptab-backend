/**
 * Created by warren on 1/18/17.
 */
const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

const paths = {
  lib: path.join(__dirname, 'lib'),
  dist: path.join(__dirname, 'dist'),
  nodeModules: path.join(__dirname, 'node_modules'),
  index: fs.readdirSync('lib')
    .filter(item => item.endsWith('.js'))
    .map(file => path.join(__dirname ,'lib', file))
    .reduce((map, str) => {
      map[str.split(/[\.\/]/).reverse()[1]] = str;
      return map
    }, {}),
  typings: path.join(__dirname, 'typings')
};

const build = {
  entry: paths.index,
  resolve: {
    extensions: ['.js']
  },
  target: 'node',
  output: {
    path: paths.dist,
    filename: '[name].js',
    libraryTarget: "commonjs"
  },
  module: {
    loaders: [
      {
        test: /\.jst$|\.md$|\.def$|\.d\.ts$|\.ts/,
        loader: 'ignore-loader',
        include: [paths.typings, paths.nodeModules]
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [paths.nodeModules, paths.typings]
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: [paths.typings, paths.nodeModules]
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ]
  },
  externals: ["aws-sdk"],
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {warnings: false, drop_console: false},
      beautify: false,
      comments: false,
      mangle: {except: ['$', 'webpackJsonp'], screw_ie8: true}
    })
  ]
};

module.exports = build;