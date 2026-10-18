"""Only configured ingress addresses may supply client-address forwarding."""
import ipaddress
import os

def trusted_proxy_ips():
    raw = os.getenv('EFLOW_TRUSTED_PROXY_IPS', '').strip()
    entries = [entry.strip() for entry in raw.split(',') if entry.strip()]
    for entry in entries:
        try:
            ipaddress.ip_network(entry, strict=False)
        except ValueError as exc:
            raise ValueError('EFLOW_TRUSTED_PROXY_IPS must contain explicit IP addresses or CIDR ranges; wildcard trust is not allowed.') from exc
    return ','.join(entries)
