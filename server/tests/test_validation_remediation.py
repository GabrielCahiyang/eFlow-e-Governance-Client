import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from services.proxy_config import trusted_proxy_ips
from pydantic import ValidationError
from routers.admin import DeleteMessagePayload, UpdateMessagePayload
from routers.invitations import InviteRow
from routers.notifications import EmailNotificationPayload
from routers.onboarding import ProgressUpdate
from routers.project_invitations import DispatchRequest

class TrustedProxyTests(unittest.TestCase):
    def test_no_default_forwarding_trust_or_wildcard(self):
        with patch.dict(os.environ,{},clear=True):self.assertEqual(trusted_proxy_ips(),'')
        with patch.dict(os.environ,{'EFLOW_TRUSTED_PROXY_IPS':'*'}):
            with self.assertRaises(ValueError):trusted_proxy_ips()

    def test_forwarded_address_only_from_explicit_ingress(self):
        async def client(peer, trusted):
            result=[]
            async def app(scope,receive,send):result.append(scope['client'][0])
            async def receive():return {'type':'http.request'}
            async def send(event):pass
            middleware=ProxyHeadersMiddleware(app,trusted_hosts=trusted)
            await middleware({'type':'http','scheme':'http','client':(peer,123),'headers':[(b'x-forwarded-for',b'203.0.113.4')]},receive,send)
            return result[0]
        self.assertEqual(asyncio.run(client('127.0.0.1','')),'127.0.0.1')
        self.assertEqual(asyncio.run(client('198.51.100.1','127.0.0.1')),'198.51.100.1')
        self.assertEqual(asyncio.run(client('127.0.0.1','127.0.0.1')),'203.0.113.4')


class PayloadBoundsTests(unittest.TestCase):
    def test_chat_message_payload_bounds(self):
        self.assertEqual(UpdateMessagePayload(messageId='msg-1', newContent='ok').messageId, 'msg-1')
        with self.assertRaises(ValidationError):
            UpdateMessagePayload(messageId='m' * 129, newContent='ok')
        with self.assertRaises(ValidationError):
            UpdateMessagePayload(messageId='msg-1', newContent='x' * 4001)
        with self.assertRaises(ValidationError):
            DeleteMessagePayload(messageId='m' * 129)

    def test_notification_and_invitation_payload_bounds(self):
        self.assertEqual(EmailNotificationPayload(userId='u-1', title='Hi', body='Body').title, 'Hi')
        with self.assertRaises(ValidationError):
            EmailNotificationPayload(userId='u-1', title='t' * 201)
        with self.assertRaises(ValidationError):
            EmailNotificationPayload(userId='u-1', body='b' * 10001)
        with self.assertRaises(ValidationError):
            InviteRow(email='a@b.co', account_role='r' * 65)
        with self.assertRaises(ValidationError):
            ProgressUpdate(status='s' * 41)
        with self.assertRaises(ValidationError):
            DispatchRequest(revision=100001)

if __name__=='__main__':unittest.main()
