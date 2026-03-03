import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { helloWorldHandler } from '../../functions/helloWorld/index';

export async function handler(event: APIGatewayProxyEventV2) {
  if (event.routeKey === 'GET /ping') {
    return helloWorldHandler(event);
  }
  return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) };
}
