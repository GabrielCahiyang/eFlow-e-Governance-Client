"""Additive administrative diagnostic endpoint; no settings or provider mutations."""
from fastapi import APIRouter, Depends
from gateway_dependencies import require_admin
from services.admin_configuration_health import configuration_health

router = APIRouter(prefix='/controlpanelEflow/api/admin', tags=['admin-configuration'])


@router.get('/configuration-health')
def read_configuration_health(_user=Depends(require_admin)):
    return configuration_health()
