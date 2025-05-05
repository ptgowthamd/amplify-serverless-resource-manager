from .websocket_service import WebsocketService
import json


class WebsocketServiceImpl(WebsocketService):
    def get_active_connections(self, table):
        """
        Get all active connections from the DynamoDB table.
        """
        response = table.scan()
        items = response.get('Items', [])
        connection_ids = [item['connectionId'] for item in items]
        return connection_ids

    def broadcast_message_to_all_active_connections(self, apigw, connection_ids, message):
        """
        Broadcast a message to all active connections.
        """
        for connection_id in connection_ids:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(message).encode('utf-8')
            )
        print("broadcasted message to all active connections")
