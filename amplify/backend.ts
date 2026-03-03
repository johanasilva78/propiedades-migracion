import { defineBackend } from '@aws-amplify/backend';
import { myApi } from './backend/api/myApi/resource';
import { helloWorld } from './backend/functions/helloWorld/resource';
import { addOutput } from '@aws-amplify/backend-output';

const backend = defineBackend({
  myApi,
  helloWorld,
});

addOutput(backend, {
  apiUrl: backend.myApi.url,
  helloWorldFunctionName: backend.helloWorld.name,
});

export { backend };
