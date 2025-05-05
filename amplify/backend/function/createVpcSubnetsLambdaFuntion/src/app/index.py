import os
import time
import uuid
from .validation import extract_user_sub, extract_user_email, validate_request_body, validate_env, validate_existance_vpc_name
from .exception_handler import handle_exception
from .vpc_service_impl import VpcServiceImpl
from .websocket_service_impl import WebsocketServiceImpl
import boto3
import json
import decimal
from urllib.parse import urlparse

def default_converter(o):
    if isinstance(o, decimal.Decimal):
        # Convert Decimal to int if no fractional part, otherwise to float.
        return int(o) if o % 1 == 0 else float(o)
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

@handle_exception
def handler(event, context):

    cors_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
        }

    print(json.dumps(event))
    print(json.dumps(event["headers"]))
    print(json.dumps(json.loads(event["body"])))
    request_body = json.loads(event["body"])
    print(request_body["vpcName"])
    # request.requestContext.authorizer.claims.sub
    print(f"requested cognito-user-id:{event["requestContext"]["authorizer"]["claims"]["sub"]}")
    print(f"requested cognito-user-email:{event["requestContext"]["authorizer"]["claims"]["email"]}")

    request_data = json.loads(event.get('body', '{}'))

    # Validate and normalize the request body
    validated_data = validate_request_body(request_data)

    # Continue processing with validated_data...
    # For example, extract the validated fields:
    vpc_name = validated_data["vpcName"]
    vpc_region = validated_data["region"]
    vpc_cidr = validated_data["cidr"]
    subnets = validated_data["subnets"]

    print(f"extracted vpc_name: {vpc_name}, region: {vpc_region}, vpc_cidr: {vpc_cidr}")
    print(f"subnets: {subnets}")

    # Extract and validate user 'sub' claim
    user_id = extract_user_sub(event)
    print(f"User sub: {user_id}")

    email_id = extract_user_email(event)
    print(f"User email: {email_id}")

    table_name = validate_env('STORAGE_USERVPCSUBNETDETAILS_NAME')
    
    # Create an EC2 client in the specified region
    ec2 = boto3.client('ec2', region_name=vpc_region)
    
    # Create a DynamoDB resource in its specified region
    region = os.environ.get('REGION')
    dynamodb = boto3.resource('dynamodb', region_name=region)

    # Instantiate the VPC service implementation
    vpc_service = VpcServiceImpl()

    table = dynamodb.Table(table_name)
    # Check for existance of VPC with vpc_name
    validate_existance_vpc_name(table, vpc_name)

    # Create VPC and subnets
    vpc_id = vpc_service.create_vpc(ec2, vpc_cidr, vpc_name)

    context.vpc_id      = vpc_id
    context.ec2_client  = ec2
    
    subnets_details = []
    # try:
    for subnet in subnets:
        details = vpc_service.create_subnet(ec2, vpc_id, subnet)
        subnets_details.append(details)
    # except Exception as e:
    #     print(f"Creation of subnets in VPC is failed. So, deleting this vpc ({vpc_id}) and subnets if any created")
    #     vpc_service.delete_vpc_and_subnets(ec2, vpc_id)
    #     raise # Re-raise the original exception
    
    # Record the VPC and subnet details in DynamoDB
    record_id = vpc_service.record_vpc_details(dynamodb, table_name, user_id, vpc_name, vpc_id, vpc_cidr, subnets_details, vpc_region)
    
    # Concatenate all subnet_ids separated by commas:
    concatenated_subnet_ids = ",".join(subnet["subnet_id"] for subnet in subnets_details)

    # Broadcast the message to all active connections
    websocket_service = WebsocketServiceImpl()
    connection_table = dynamodb.Table(os.environ['STORAGE_CONNECTIONS_NAME'])

    # Full WebSocket URLs for your frontends
    WS_URLS = {
        'dev':      'wss://abcd1234.execute-api.ap-south-1.amazonaws.com/dev',
        'stagging': 'wss://ezvv0dxmv2.execute-api.ap-south-1.amazonaws.com/stagging',
        'prod':     'wss://lmno9012.execute-api.ap-south-1.amazonaws.com/prod',
    }

    ENV = os.environ.get('ENV', 'dev')

    FULL_WS_URL = WS_URLS[ENV]

    parsed = urlparse(FULL_WS_URL)
    API_GW_ENDPOINT = f"https://{parsed.netloc}{parsed.path}"

    apigw = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=API_GW_ENDPOINT
    )

    connection_ids = websocket_service.get_active_connections(connection_table)
    websocket_service.broadcast_message_to_all_active_connections(apigw, connection_ids, {
        'message': {"text": f"VPC ({vpc_id}) and Subnets ({concatenated_subnet_ids}) created successfully in region ({vpc_region}) by user ({email_id.split('@')[0]})."},
        'action': "newMessage",
        # 'action': "notifyMessage",
        'sender': "system"
    })

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps({
            'message': f'VPC ({vpc_id}) and Subnets ({concatenated_subnet_ids}) created and recorded successfully.'
            }, default=default_converter)
    }