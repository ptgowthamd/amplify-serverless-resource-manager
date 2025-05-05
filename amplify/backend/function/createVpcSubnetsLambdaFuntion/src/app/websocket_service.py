class WebsocketService:
    def get_active_connections(self, table):
        raise NotImplementedError("Subclasses must implement this method")
    def broadcast_message_to_all_active_connections(self, apigw, connection_ids, message):
        raise NotImplementedError("Subclasses must implement this method")