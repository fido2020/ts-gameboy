A gameboy emulator in TypeScript (real webdev scares me, so I made an emulator) 

## Building
Requres `esbuild` and `typescript`, install via `npm`.

Run
```sh
npm run build
```

## Running
If you have `http-server` from `npm` you can run from the repo directory:
```
npx http-server
```

Right now it assumes there is `./tetris.gb` available from the server.
