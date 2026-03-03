import { lambda } from '@aws-amplify/backend';

export const helloWorld = lambda({
  name: 'helloWorld',
  handler: './index.js',
  runtime: 'nodejs20.x',
});
