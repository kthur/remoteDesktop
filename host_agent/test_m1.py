import asyncio
import json
import socket
from main import get_local_ip_addresses, check_usb_adb_availability, start_udp_discovery_service

async def test_udp_discovery():
    print("Testing get_local_ip_addresses()...")
    local_ips = get_local_ip_addresses()
    print("Local IPs detected:", local_ips)
    assert len(local_ips) > 0, "No local IPs detected"

    print("Testing check_usb_adb_availability()...")
    usb_avail = check_usb_adb_availability()
    print("USB ADB Available:", usb_avail)

    def current_net_info():
        return {
            "local_ips": local_ips,
            "ws_port": 8080,
            "usb_available": usb_avail
        }

    print("Starting UDP Discovery Service on port 8888...")
    udp_transport = await start_udp_discovery_service(
        "test_device_py_1",
        "Python-Host-PC",
        "test_user_py_1",
        current_net_info
    )

    try:
        loop = asyncio.get_running_loop()
        response_future = loop.create_future()

        class ClientUDPProtocol(asyncio.DatagramProtocol):
            def connection_made(self, transport):
                transport.sendto(b"ANYREMOTE_DISCOVER_REQ", ("127.0.0.1", 8888))

            def datagram_received(self, data, addr):
                if not response_future.done():
                    response_future.set_result((data, addr))

        client_transport, _ = await loop.create_datagram_endpoint(
            lambda: ClientUDPProtocol(),
            local_addr=('127.0.0.1', 0)
        )

        data, addr = await asyncio.wait_for(response_future, timeout=2.0)
        client_transport.close()

        resp = json.loads(data.decode('utf-8'))
        print("Received UDP Response from", addr, ":", json.dumps(resp, indent=2))

        assert resp.get("service") == "AnyRemote_PC_Host", "Invalid service name"
        assert resp.get("device_id") == "test_device_py_1", "Invalid device_id"
        assert resp.get("status") == "ok", "Invalid status"
        assert "direct_ws_urls" in resp, "Missing direct_ws_urls"

        print("Python UDP discovery test PASSED successfully!")
    finally:
        if udp_transport:
            udp_transport.close()

if __name__ == "__main__":
    asyncio.run(test_udp_discovery())
