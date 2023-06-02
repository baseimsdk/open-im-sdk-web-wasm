# open-im-sdk-wasm

## how to use

* run  `yarn add open-im-sdk-wasm`
* export all assets files to your public forder(make sure you can access file by http request, and place the wasm_exec.js in your html file)
* config your http-server, make sure the response header contains `Cross-Origin-Opener-Policy:same-origin` and `Cross-Origin-Embedder-Policy:require-corp`
* then add code as below
  ```typescript
  import { getSDK } from 'open-im-sdk-wasm';

  const sdk = getSDK();
  ```
