import {
    readFile,
    mkdir
} from 'node:fs/promises';

import {
    build
} from 'esbuild';


const userscriptHeader =
    await readFile(
        'userscript-header.txt',
        'utf8'
    );


await mkdir(
    'dist',
    {
        recursive: true
    }
);


await build({

    entryPoints: [
        './src/main.js'
    ],

    bundle: true,

    outfile:
        'dist/vinted-favorites-organizer.user.js',

    format:
        'iife',

    platform:
        'browser',

    target: [
        'chrome120'
    ],

    banner: {
        js:
            userscriptHeader
    },

    legalComments:
        'none'

});


console.log(
    'Build concluído: dist/vinted-favorites-organizer.user.js'
);