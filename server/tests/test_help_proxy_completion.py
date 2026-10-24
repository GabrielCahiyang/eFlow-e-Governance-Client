import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from routers.help_assistant import assistant


class HelpProxyCompletionTests(unittest.IsolatedAsyncioTestCase):
    async def test_response_wakes_without_poll_delay_and_keeps_original_session(self):
        request=AsyncMock();request.method='GET';request.is_disconnected.return_value=False
        completed=asyncio.Event()
        async def proxy(*args,**kwargs):
            await completed.wait()
            return {'ready':True}
        with patch('routers.help_assistant._proxy',new=AsyncMock(side_effect=proxy)) as forward:
            task=asyncio.create_task(assistant('status',request,user={'id':'actor'},credentials=SimpleNamespace(credentials='synthetic-session')))
            await asyncio.sleep(0);completed.set()
            self.assertEqual(await asyncio.wait_for(task,.1),{'ready':True})
            self.assertEqual(forward.call_args.kwargs['session_token'],'synthetic-session')
            self.assertEqual(forward.call_args.kwargs['timeout_seconds'],210)

    async def test_disconnect_cancels_and_joins_proxy_request(self):
        request=AsyncMock();request.method='GET';request.is_disconnected.return_value=True
        with patch('routers.help_assistant._proxy',new=AsyncMock()) as forward:
            with self.assertRaises(asyncio.CancelledError):
                await assistant('status',request,user={'id':'actor'},credentials=SimpleNamespace(credentials='synthetic-session'))
            # The owned coroutine is cancelled before it can start any HTTP work.
            forward.assert_called_once()
