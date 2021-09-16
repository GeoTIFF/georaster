const webpack = require("webpack");
const path = require("path");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ThreadsPlugin = require("threads-plugin");

module.exports = (env, argv) => {
    const { mode, target } = argv;

    const isProd = mode === "production";
    const isDev = mode === "development";

    const targetFileNamePart = target === "node" ? ".node" : ".browser";

    // PLUGINS =========================================================
    const plugins = [
        // new webpack.ProvidePlugin({
        //   txml: "txml",
        // }),
        new CleanWebpackPlugin(),
        new webpack.IgnorePlugin({
            checkResource: (resource, context) => {
                if (resource.includes("ts-node")) return true;
                return false;
            }
        }),
        new ThreadsPlugin()
    ];
    if (process.env.ANALYZE_GEORASTER_BUNDLE) {
        plugins.push(
            new BundleAnalyzerPlugin({
                analyzerHost: process.env.ANALYZER_HOST || "127.0.0.1"
            })
        );
    }

    // EXTERNALS =========================================================
    const externals = {
        fs: "fs",

        // we do this because we don't need this library when running in the browser
        pngjs: "pngjs",

        "ts-node": {}
    };
    // because don't want node-fetch in bundle meant for web
    if (target === "web") externals["node-fetch"] = "node-fetch";

    // because threads can look for this
    // https://threads.js.org/getting-started#nodejs-bundles
    if (target === "node") externals["tiny-worker"] = "tiny-worker";

    // only need txml if running on node
    if (target === "web") externals["txml"] = "txml";

    // NODE =========================================================
    const node = {};

    // neutralize ts-node, which we don't even use
    // node["ts-node"] = "empty";

    // neutralize import 'threads/register' in geotiff.js
    // node["threads/register"] = "empty";

    // can't access fs on the web
    if (target === "web") node["fs"] = "empty";

    // RESOLVE =========================================================
    const resolve = {
        alias: {
            geotiff: path.resolve(
                __dirname,
                "./node_modules/geotiff/src/geotiff.js"
            ),
            threads: path.resolve(__dirname, "./node_modules/threads/dist/")
        },
        extensions: [".js", ".json", ".mjs", ".wasm", ".ejs", ".ts", ".tsx"]
    };
    // : {
    //       alias: {
    //         // txml: path.resolve(__dirname, "./node_modules/txml/tXml.min.js"),
    //         // "threads": path.resolve(__dirname, "./node_modules/threads/")
    //         "geotiff": isProd ? path.resolve(__dirname, "./node_modules/threads/")
    //       },
    //     }
    // if (target === "node") {
    //   resolve.alias['geotiff'] = path.resolve(__dirname, "./node_modules/geotiff/dist-node/geotiff.js");
    // } else if (target === "web") {
    //   resolve.alias['geotiff'] = path.resolve(__dirname, "./node_modules/geotiff/dist-browser/geotiff.js");
    // }

    return {
        entry: "./src/index.js",
        mode,
        target: target,
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: isProd
                ? `georaster${targetFileNamePart}.min.js`
                : `georaster${targetFileNamePart}.js`,
            globalObject: "typeof self !== 'undefined' ? self : this",
            library: "GeoRaster",
            libraryTarget: "umd"
        },
        resolve,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /(node_modules)/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env"],
                            plugins: []
                        }
                    }
                },
                {
                    test: /worker\.js$/,
                    use: {
                        loader: "worker-loader",
                        options: {
                            inline: true,
                            fallback: false
                        }
                    }
                },
                {
                    test: /\.ts$/,
                    use: {
                        loader: "ts-loader"
                    }
                }
            ]
        },
        node,
        externals,
        plugins
    };
};
