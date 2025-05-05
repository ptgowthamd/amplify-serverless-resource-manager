# disconnect_handler.py
import os
import json
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ['STORAGE_CONNECTIONS_NAME']
ddb = boto3.resource('dynamodb')
table = ddb.Table(TABLE_NAME)

def handler(event, context):
    """
    $disconnect handler: removes the connectionId from DynamoDB.
    """
    connection_id = event['requestContext'].get('connectionId')
    if not connection_id:
        logger.error("No connectionId in requestContext: %s", event)
        return {'statusCode': 400, 'body': 'Missing connectionId'}

    try:
        table.delete_item(Key={'connectionId': connection_id})
        logger.info("Deleted connectionId %s", connection_id)
        return {'statusCode': 200, 'body': 'Disconnected.'}

    except ClientError as e:
        logger.exception("Error deleting connectionId %s", connection_id)
        return {'statusCode': 500, 'body': 'Failed to disconnect.'}
