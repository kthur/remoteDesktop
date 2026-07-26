import os
import json

try:
    import qrcode
except ImportError:
    qrcode = None

def generate_host_qr(device_id, device_name, primary_url, direct_urls=None, save_filename="host_qr.png"):
    """Generates ASCII QR code in terminal and saves PNG image file."""
    payload = {
        "service": "AnyRemote",
        "device_id": device_id,
        "device_name": device_name,
        "url": primary_url,
        "direct_urls": direct_urls or []
    }
    payload_str = json.dumps(payload)

    print("\n==================================================")
    print(" 📲 AnyRemote HOST PC QR Code Connection Info")
    print(f" Target Device: {device_name} ({device_id})")
    print(f" Connection URL: {primary_url}")
    print("==================================================\n")

    if qrcode:
        try:
            # 1. Print Terminal ASCII QR Code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=1,
                border=1,
            )
            qr.add_data(payload_str)
            qr.make(fit=True)
            qr.print_ascii(invert=True)

            # 2. Save PNG Image File
            img_qr = qrcode.make(payload_str)
            img_qr.save(save_filename)
            print(f"\n [QR SAVED] Image saved to: {os.path.abspath(save_filename)}")
            return True
        except Exception as e:
            print(f" [QR WARNING] QR rendering error: {e}")
    else:
        print(" [QR NOTICE] 'qrcode' python package not installed. Install via: pip install qrcode[pil]")

    print(f" Raw Connection Payload: {payload_str}\n")
    return False

if __name__ == "__main__":
    generate_host_qr("pc_test_01", "Demo PC Host", "ws://192.168.1.100:8080", ["ws://127.0.0.1:8080"])
