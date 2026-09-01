import re

with open('app/api/inspections.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Blockchain mock from /upload
blockchain_code = """    # Generate Mock Blockchain TxHash for MVP Demo
    import secrets
    validation_results["blockchain_tx_hash"] = "0x" + secrets.token_hex(32)

"""
content = content.replace(blockchain_code, "")

# 2. Remove /scan-url endpoint
url_endpoint_pattern = re.compile(r'from pydantic import BaseModel.*?return \{(?:[^{}]*|\{[^{}]*\})*\}', re.DOTALL)
content = re.sub(url_endpoint_pattern, '', content)

with open('app/api/inspections.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed backend features")
