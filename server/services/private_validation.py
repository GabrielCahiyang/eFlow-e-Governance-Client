"""Never echo secret-bearing request bodies in framework validation errors."""
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute


class PrivateValidationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                raise HTTPException(422, 'Check the account fields and password requirements.') from exc
        return handler
