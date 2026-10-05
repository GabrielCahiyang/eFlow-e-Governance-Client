"""eFlow control gateway exposed through the Cloudflare tunnel on port 8322."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gateway_config import settings
from routers.admin import router as admin_router
from routers.ai import router as ai_router
from routers.proposals import router as proposals_router
from routers.notifications import router as notifications_router
from routers.backups import router as backups_router
from routers.collaboration import router as collaboration_router
from routers.invitations import router as invitations_router, team_router
from routers.professional_profiles import router as professional_profiles_router
from routers.onboarding import router as onboarding_router
from routers.staffing import router as staffing_router
from pds.worker import start_worker


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)

@asynccontextmanager
async def lifespan(_app):
    worker_stop = start_worker()
    yield
    worker_stop.set()

app = FastAPI(title="eFlow Control Gateway", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/controlpanelEflow/api/health")
async def health():
    return {"status": "ok", "service": "eflow-control-gateway"}


app.include_router(ai_router)
app.include_router(proposals_router)
app.include_router(admin_router)
app.include_router(notifications_router)
app.include_router(backups_router)
app.include_router(collaboration_router)
app.include_router(invitations_router)
app.include_router(team_router)
app.include_router(professional_profiles_router)
app.include_router(onboarding_router)
app.include_router(staffing_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8322)
