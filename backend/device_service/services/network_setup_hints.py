"""Derive LAN hints for ZKTeco terminal setup from this host's IPv4 addresses."""

from __future__ import annotations

import ipaddress
import os
import socket
from typing import List


def collect_local_ipv4_addresses() -> List[str]:
    """Return unique non-loopback IPv4 addresses reported for this host."""
    seen: set[str] = set()
    out: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            ip = info[4][0]
            if ip.startswith("127."):
                continue
            if ip not in seen:
                seen.add(ip)
                out.append(ip)
    except OSError:
        pass
    if not out:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if not ip.startswith("127."):
                out.append(ip)
        except OSError:
            pass
    return out


def _suggest_device_ipv4(
    addr: ipaddress.IPv4Address,
    reserved_hosts: set[str] | None = None,
) -> str:
    """Pick a /24 host IP not used by this machine or any reserved address (e.g. other devices)."""
    reserved_hosts = reserved_hosts or set()
    network = ipaddress.ip_network(f"{addr}/24", strict=False)
    last_octet = int(addr.packed[-1])
    for c in list(range(200, 255)) + list(range(2, 200)):
        if c in (1, last_octet, 255):
            continue
        candidate = str(network.network_address + c)
        if candidate not in reserved_hosts:
            return candidate
    for c in range(2, 255):
        if c in (1, last_octet, 255):
            continue
        candidate = str(network.network_address + c)
        if candidate not in reserved_hosts:
            return candidate
    return str(network.network_address + 201)


def build_subnet_hints(reserved_ipv4: set[str] | None = None) -> tuple[list[dict], list[str]]:
    """
    Build per-subnet hints and environment warnings.

    Returns:
        (subnets as dicts for Pydantic, warning strings)
    """
    warnings: list[str] = []
    if os.path.exists("/.dockerenv"):
        warnings.append(
            "This service is running inside Docker. The addresses below may be the "
            "container's IPs, not your office LAN. On Windows, check ipconfig on the PC "
            "that can reach the K40, or use host networking for the device service."
        )

    subnets: list[dict] = []
    for ip_str in collect_local_ipv4_addresses():
        try:
            addr = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if not isinstance(addr, ipaddress.IPv4Address) or not addr.is_private:
            continue
        network = ipaddress.ip_network(f"{addr}/24", strict=False)
        gw = str(network.network_address + 1)
        reserved = set(reserved_ipv4 or ())
        reserved.add(ip_str)
        k40_ip = _suggest_device_ipv4(addr, reserved_hosts=reserved)
        subnets.append(
            {
                "your_pc_or_server_ip": ip_str,
                "subnet_mask": str(network.netmask),
                "suggested_gateway": gw,
                "suggested_k40_ip": k40_ip,
                "dns_suggestion": gw,
            }
        )
    if not subnets and not warnings:
        warnings.append(
            "No private IPv4 address was detected on this host. Use ipconfig (Windows) or "
            "ifconfig/ip addr on the machine on the same LAN as the K40."
        )
    return subnets, warnings
