import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export default (env, params) => {
    return {
        devtool: env.SOURCE_MAP === 'true' ? 'source-map' : false,
        mode: params.mode,
        entry: './frontend/client.js',
        cache: {
            type: 'filesystem',
            // One cache per mode. An explicit cacheLocation ignores cache.name, so without the mode
            // in the path `npm run dev --hot` and `npm run build` share entries, and a production
            // build restores modules compiled with hot reload code it cannot resolve.
            cacheLocation: path.resolve(__dirname, '.webpack_cache', params.mode),
        },
        optimization: {
            minimizer: [
                new TerserPlugin({
                    parallel: true,
                    extractComments: false,
                    terserOptions: {
                        format: { comments: false },
                    },
                }),
            ],
        },
        output: {
            path: path.resolve(__dirname, 'www'),
            filename: 'perun-core.js',
            // Chunks loaded on demand are emitted beside the bundle and fetched from wherever it
            // was served from, so a dependent project has to carry them across with it. Naming them
            // rather than numbering them is what keeps that a fixed list: a chunk given a name in
            // its import() keeps that file name from build to build, where an id can shift as soon
            // as the module graph does.
            chunkFilename: '[name].perun-core.js',
            library: { name: 'perun-core', type: 'umd' },
            globalObject: 'this'
        },
        devServer: {
            client: {
                overlay: false
            },
            static: {
                directory: path.join(__dirname, 'www'),
            },
            compress: true
        },
        plugins: [
            new webpack.ProvidePlugin({
                process: 'process/browser',
            }),
            new webpack.DefinePlugin({
                'process.env.DEBUG': JSON.stringify(env.DEBUG),
                'process.env.MODE': JSON.stringify(params.mode),
            })
        ],
        module: {
            rules: [
                {
                    test: /\.(js|jsx)?$/,
                    exclude: /(node_modules)/,
                    use: [
                        'thread-loader',
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    ['@babel/preset-env', { targets: '> 0.5%, last 2 versions, not dead' }],
                                    '@babel/preset-react',
                                ],
                                cacheDirectory: true,
                            },
                        },
                    ]
                },
                {
                    // For pure CSS (without CSS modules)
                    test: /\.css$/i,
                    exclude: /\.module\.css$/i,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    // For CSS modules
                    test: /\.module\.css$/i,
                    use: [
                        'style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                modules: {
                                    localIdentName: '[name]-[local]'
                                }
                            },
                        },
                    ],
                },
                {
                    test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
                    type: 'asset/resource',
                },
                {
                    test: /\.m?js$/,
                    resolve: { fullySpecified: false }
                },
            ]
        },
        resolve: {
            modules: [ // fix all import paths that are not relative, then remove this.
                path.resolve('./frontend'),
                path.resolve('./node_modules'),
                path.resolve('./lib')
            ],
            extensions: ['.js', '.jsx'],
            fallback: {
                'url': require.resolve('url')
            }
        }
    }
};
