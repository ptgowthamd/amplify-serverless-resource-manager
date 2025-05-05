# message_handler.py

import os
import json
import logging
import boto3
from botocore.exceptions import ClientError
from urllib.parse import urlparse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB table name from env
TABLE_NAME = os.environ['STORAGE_CONNECTIONS_NAME']

# Amplify env (dev / stagging / prod)
ENV = os.environ.get('ENV', 'dev').lower()

# Full WebSocket URLs for your frontends
WS_URLS = {
    'dev':      'wss://abcd1234.execute-api.ap-south-1.amazonaws.com/dev',
    'stagging': 'wss://ezvv0dxmv2.execute-api.ap-south-1.amazonaws.com/stagging',
    'prod':     'wss://lmno9012.execute-api.ap-south-1.amazonaws.com/prod',
}

# Pick the WS URL for this env (for logging or returning to clients if needed)
try:
    FULL_WS_URL = WS_URLS[ENV]
except KeyError:
    raise RuntimeError(f"Invalid ENV '{ENV}'. Valid: {list(WS_URLS.keys())}")

# Parse out the host+stage so we can talk to the API Gateway Management API:
# e.g. from "wss://abcd1234.execute-api.ap-south-1.amazonaws.com/dev"
# to   "https://abcd1234.execute-api.ap-south-1.amazonaws.com/dev"
parsed = urlparse(FULL_WS_URL)
API_GW_ENDPOINT = f"https://{parsed.netloc}{parsed.path}"

logger.info("Using API Gateway endpoint: %s", API_GW_ENDPOINT)

# AWS clients
ddb   = boto3.resource('dynamodb')
table = ddb.Table(TABLE_NAME)

apigw = boto3.client(
    'apigatewaymanagementapi',
    endpoint_url=API_GW_ENDPOINT
)

def handler(event, context):
    """
    sendMessage handler: broadcasts { message: data } to all active connections.
    """
    route_key = event['requestContext'].get('routeKey')
    if route_key != 'sendMessage':
        logger.warning("Unsupported route: %s", route_key)
        return {'statusCode': 400, 'body': 'Unsupported route'}

    # Parse the incoming message
    try:
        body = json.loads(event.get('body', '{}'))
        message_data = body['data']
        sender = body.get('sender', 'unknown')
    except (json.JSONDecodeError, KeyError):
        logger.error("Invalid payload: %s", event.get('body'))
        return {'statusCode': 400, 'body': 'Invalid payload'}

    # Collect all connection IDs (with pagination)
    connection_ids = []
    scan_kwargs = {'ProjectionExpression': 'connectionId'}
    while True:
        resp = table.scan(**scan_kwargs)
        connection_ids += [item['connectionId'] for item in resp.get('Items', [])]
        last = resp.get('LastEvaluatedKey')
        if not last:
            break
        scan_kwargs['ExclusiveStartKey'] = last

    logger.info("Broadcasting to %d connections", len(connection_ids))

    # Send to each, deleting stale ones
    for cid in connection_ids:
        try:
            apigw.post_to_connection(
                ConnectionId=cid,
                Data=json.dumps({'action':  'newMessage','message': message_data, 'sender': sender}).encode('utf-8')
            )
        except ClientError as e:
            code = e.response['Error']['Code']
            status = e.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
            if code == 'GoneException' or status == 410:
                logger.info("Stale connection %s, deleting from table", cid)
                table.delete_item(Key={'connectionId': cid})
            else:
                logger.exception("Error posting to %s", cid)

    return {'statusCode': 200, 'body': 'Message broadcast.'}