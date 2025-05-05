# connect_handler.py
import os
import json
import logging
import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment-driven table name
TABLE_NAME = os.environ['STORAGE_CONNECTIONS_NAME']

# DynamoDB client/resource
ddb = boto3.resource('dynamodb')
table = ddb.Table(TABLE_NAME)

def handler(event, context):
    """
    $connect handler: stores the new connectionId in DynamoDB.
    """
    connection_id = event['requestContext'].get('connectionId')
    if not connection_id:
        logger.error("No connectionId in requestContext: %s", event)
        return {'statusCode': 400, 'body': 'Missing connectionId'}

    try:
        table.put_item(Item={'connectionId': connection_id})
        logger.info("Stored connectionId %s", connection_id)
        return {'statusCode': 200, 'body': 'Connected.'}

    except ClientError as e:
        logger.exception("Error storing connectionId %s", connection_id)
        return {'statusCode': 500, 'body': 'Failed to connect.'}
