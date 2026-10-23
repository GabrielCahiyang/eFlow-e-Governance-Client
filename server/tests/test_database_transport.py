"""Disconnected Office Team reads must recover without replaying mutations."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.database_transport import database_http_client, database_read


class DatabaseTransportTests(unittest.TestCase):
    def test_client_isolates_connections_without_enabling_write_retries(self):
        with patch('services.database_transport.httpx.Client') as factory:
            database_http_client()
        options = factory.call_args.kwargs
        self.assertFalse(options['http2'])
        self.assertNotIn('transport', options)  # no blanket retries for POSTs
        self.assertEqual(options['timeout'].read, 120)
        self.assertEqual(options['limits'].keepalive_expiry, 10)

    def test_real_http_client_recovers_after_one_disconnected_read(self):
        requests = []
        def upstream(request):
            requests.append(request)
            if len(requests) == 1:
                raise httpx.RemoteProtocolError('Server disconnected', request=request)
            return httpx.Response(200, json={'members': [{'id': 'member'}]})
        with httpx.Client(transport=httpx.MockTransport(upstream)) as client, patch('services.database_transport.time.sleep'):
            result = database_read(lambda: client.get('https://example.test/office-team').json())
        self.assertEqual(result['members'], [{'id': 'member'}])
        self.assertEqual(len(requests), 2)

    def test_configured_client_never_replays_a_lost_post_response(self):
        with database_http_client() as client, patch('httpx.HTTPTransport.handle_request', side_effect=[httpx.RemoteProtocolError('lost write response'), httpx.Response(200, json=[])]) as send:
            with self.assertRaises(httpx.RemoteProtocolError):
                client.post('https://example.test/rest/v1/user_invitations', json={'email': 'test@example.test'})
            self.assertEqual(send.call_count, 1)
            self.assertEqual(client.get('https://example.test/rest/v1/profiles').json(), [])
            self.assertEqual(send.call_count, 2)

    def test_repeated_disconnect_is_bounded_and_has_safe_retry_message(self):
        with patch('services.database_transport.time.sleep') as sleep:
            calls = []
            def unavailable():
                calls.append(True)
                raise httpx.RemoteProtocolError('private upstream details')
            with self.assertRaises(HTTPException) as result:
                database_read(unavailable)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result.exception.status_code, 503)
        self.assertNotIn('private', result.exception.detail)
        sleep.assert_called_once()

    def test_authorization_denial_is_not_retried_or_converted_to_success(self):
        calls = []
        def denied():
            calls.append(True)
            raise HTTPException(403, 'Only the appointed active Office Head can manage invitations.')
        with self.assertRaises(HTTPException) as result:
            database_read(denied)
        self.assertEqual(result.exception.status_code, 403)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
