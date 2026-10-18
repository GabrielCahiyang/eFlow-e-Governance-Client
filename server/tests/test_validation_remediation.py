import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from services.proxy_config import trusted_proxy_ips

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

if __name__=='__main__':unittest.main()
